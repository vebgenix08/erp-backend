import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { planningStore, type PlanningStore } from "../planning-store/planning-store.repository";
import { studentRepository, type StudentRepository } from "../students/students.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type {
  MentorInteraction,
  TeacherMenteeSummary,
  TeacherMenteeWorkspace,
  TeacherMentoringPage,
} from "./teacher-mentoring.model";
import {
  teacherMentoringRepository,
  type TeacherMentoringRepository,
} from "./teacher-mentoring.repository";
import {
  validateAssignmentId,
  validateAssignStudentMentorInput,
  validateMentorInteractionStatusInput,
  validateSaveMentorInteractionInput,
  validateTeacherMentoringPageInput,
} from "./teacher-mentoring.validator";

export interface TeacherMentoringDependencies extends TeacherWorkloadDependencies {
  repository?: TeacherMentoringRepository;
  students?: StudentRepository;
  planning?: PlanningStore;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
  now?: () => Date;
}

const tenant = (context: RequestContext) => {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
};
const actor = (context: RequestContext) => {
  const userId = context.authContext?.user?.id?.trim();
  if (!userId) throw new ForbiddenError("authenticated user is required");
  return userId;
};
const timestamp = (deps: TeacherMentoringDependencies) =>
  (deps.now ?? (() => new Date()))().toISOString();
const records = (deps: TeacherMentoringDependencies) =>
  deps.repository ?? teacherMentoringRepository();
const students = async (deps: TeacherMentoringDependencies) =>
  deps.students ?? (await studentRepository());
const store = (deps: TeacherMentoringDependencies) =>
  deps.planning ?? deps.store ?? planningStore();
const isEffective = (from: string, until: string | undefined, date: string) =>
  from <= date && (!until || date <= until);

async function teacherContext(
  academicYearId: string | undefined,
  context: RequestContext,
  deps: TeacherMentoringDependencies,
) {
  return (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    { ...(academicYearId ? { academicYearId } : {}), viewMode: "PUBLISHED" },
    context,
    deps,
  );
}

async function requireOwnedAssignment(
  assignmentId: string,
  context: RequestContext,
  deps: TeacherMentoringDependencies,
) {
  const assignment = await records(deps).getAssignment(tenant(context), assignmentId);
  if (!assignment || assignment.status !== "ACTIVE")
    throw new NotFoundError("mentee assignment was not found");
  const workspace = await teacherContext(assignment.academicYearId, context, deps);
  if (assignment.mentorEmployeeId !== workspace.teacher.id)
    throw new NotFoundError("mentee assignment was not found");
  const today = timestamp(deps).slice(0, 10);
  if (!isEffective(assignment.effectiveFrom, assignment.effectiveUntil, today))
    throw new NotFoundError("mentee assignment was not found");
  return { assignment, workspace };
}

async function summary(
  assignment: Awaited<ReturnType<TeacherMentoringRepository["getAssignment"]>> & {},
  interactions: MentorInteraction[],
  deps: TeacherMentoringDependencies,
): Promise<TeacherMenteeSummary | null> {
  const value = await (await students(deps)).getById(assignment.tenantId, assignment.studentId);
  if (!value || value.student.status !== "ACTIVE" || value.enrollment.status !== "ACTIVE")
    return null;
  const planning = store(deps);
  const [academicClass, section] = await Promise.all([
    planning.get("academics_classes", assignment.tenantId, value.enrollment.classId),
    value.enrollment.sectionId
      ? planning.get("academics_sections", assignment.tenantId, value.enrollment.sectionId)
      : Promise.resolve(null),
  ]);
  const sorted = [...interactions].sort((left, right) =>
    right.interactionDate.localeCompare(left.interactionDate),
  );
  const nextFollowUp = interactions
    .filter((item) => item.status === "OPEN" && item.followUpDate)
    .sort((left, right) => String(left.followUpDate).localeCompare(String(right.followUpDate)))[0];
  return {
    assignmentId: assignment.id,
    studentId: value.student.id,
    studentName: value.student.name,
    registrationNumber: value.student.registrationNumber,
    ...(value.enrollment.rollNumber ? { rollNumber: value.enrollment.rollNumber } : {}),
    campusId: value.enrollment.campusId,
    className:
      typeof academicClass?.name === "string" ? academicClass.name : "Class not configured",
    ...(typeof section?.name === "string" ? { sectionName: section.name } : {}),
    guardianName: value.student.guardian.name,
    ...(value.student.guardian.phone ? { guardianPhone: value.student.guardian.phone } : {}),
    ...(sorted[0] ? { lastInteractionAt: sorted[0].interactionDate } : {}),
    ...(nextFollowUp?.followUpDate ? { nextFollowUpDate: nextFollowUp.followUpDate } : {}),
    openActionCount: interactions
      .filter((item) => item.status === "OPEN")
      .reduce((sum, item) => sum + Math.max(1, item.actionItems.length), 0),
  };
}

export async function listTeacherMentees(
  value: unknown,
  context: RequestContext,
  deps: TeacherMentoringDependencies = {},
): Promise<TeacherMentoringPage> {
  const input = validateTeacherMentoringPageInput(value);
  const workspace = await teacherContext(input.academicYearId, context, deps);
  const today = timestamp(deps).slice(0, 10);
  const hasMentorResponsibility = workspace.responsibilities.some(
    (item) =>
      item.responsibilityType === "MENTOR" &&
      isEffective(item.effectiveFrom, item.effectiveUntil, today),
  );
  if (!hasMentorResponsibility)
    return {
      items: [],
      page: input.page,
      pageSize: input.pageSize,
      total: 0,
      totalPages: 1,
      pendingFollowUps: 0,
      openActions: 0,
    };
  const assignments = (
    await records(deps).listAssignments(
      tenant(context),
      workspace.teacher.id,
      workspace.academicYear.id,
    )
  ).filter((item) => isEffective(item.effectiveFrom, item.effectiveUntil, today));
  const all = (
    await Promise.all(
      assignments.map(async (assignment) => {
        const interactions = await records(deps).listInteractions(tenant(context), assignment.id);
        return summary(assignment, interactions, deps);
      }),
    )
  ).filter((item): item is TeacherMenteeSummary => Boolean(item));
  const search = input.search?.toLocaleLowerCase();
  const filtered = search
    ? all.filter((item) =>
        `${item.studentName} ${item.registrationNumber} ${item.rollNumber ?? ""} ${item.className} ${item.sectionName ?? ""}`
          .toLocaleLowerCase()
          .includes(search),
      )
    : all;
  const offset = (input.page - 1) * input.pageSize;
  return {
    items: filtered.slice(offset, offset + input.pageSize),
    page: input.page,
    pageSize: input.pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / input.pageSize)),
    pendingFollowUps: all.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate <= today)
      .length,
    openActions: all.reduce((sum, item) => sum + item.openActionCount, 0),
  };
}

export async function getTeacherMenteeWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherMentoringDependencies = {},
): Promise<TeacherMenteeWorkspace> {
  const assignmentId = validateAssignmentId(value);
  const { assignment } = await requireOwnedAssignment(assignmentId, context, deps);
  const interactions = await records(deps).listInteractions(tenant(context), assignment.id);
  const mentee = await summary(assignment, interactions, deps);
  if (!mentee) throw new NotFoundError("mentee student record was not found");
  return { mentee, interactions };
}

export async function saveTeacherMentorInteraction(
  value: unknown,
  context: RequestContext,
  deps: TeacherMentoringDependencies = {},
) {
  const input = validateSaveMentorInteractionInput(value);
  const { assignment } = await requireOwnedAssignment(input.assignmentId, context, deps);
  const repository = records(deps);
  const existing = input.id ? await repository.getInteraction(tenant(context), input.id) : null;
  if (
    input.id &&
    (!existing ||
      existing.assignmentId !== assignment.id ||
      existing.mentorEmployeeId !== assignment.mentorEmployeeId)
  )
    throw new NotFoundError("mentoring interaction was not found");
  if (existing && existing.status !== "OPEN")
    throw new ConflictError("only open mentoring interactions can be edited");
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version)
    throw new ConflictError("mentoring interaction version is stale");
  const now = timestamp(deps);
  const userId = actor(context);
  return repository.saveInteraction(
    {
      id: existing?.id ?? `mentor_interaction_${crypto.randomUUID()}`,
      tenantId: assignment.tenantId,
      assignmentId: assignment.id,
      academicYearId: assignment.academicYearId,
      campusId: assignment.campusId,
      mentorEmployeeId: assignment.mentorEmployeeId,
      studentId: assignment.studentId,
      interactionType: input.interactionType,
      interactionDate: input.interactionDate,
      summary: input.summary,
      actionItems: input.actionItems,
      ...(input.followUpDate ? { followUpDate: input.followUpDate } : {}),
      visibility: input.visibility,
      status: "OPEN",
      version: (existing?.version ?? 0) + 1,
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? now,
      updatedBy: userId,
      updatedAt: now,
    },
    existing?.version,
  );
}

export async function setTeacherMentorInteractionStatus(
  value: unknown,
  context: RequestContext,
  deps: TeacherMentoringDependencies = {},
) {
  const input = validateMentorInteractionStatusInput(value);
  const repository = records(deps);
  const current = await repository.getInteraction(tenant(context), input.id);
  if (!current) throw new NotFoundError("mentoring interaction was not found");
  await requireOwnedAssignment(current.assignmentId, context, deps);
  if (current.version !== input.expectedVersion)
    throw new ConflictError("mentoring interaction version is stale");
  if (current.status !== "OPEN") throw new ConflictError("mentoring interaction is already closed");
  const now = timestamp(deps);
  return repository.saveInteraction(
    {
      ...current,
      status: input.status,
      ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: now,
    },
    current.version,
  );
}

function requireAssignmentPermission(context: RequestContext) {
  const user = context.authContext?.user;
  const allowedRole = user?.role === "TENANT_ADMIN" || user?.role === "ADMIN";
  if (!allowedRole && !user?.permissions.includes("academics.mentoring.assign"))
    throw new ForbiddenError("permission academics.mentoring.assign is required");
}

export async function assignStudentMentor(
  value: unknown,
  context: RequestContext,
  deps: TeacherMentoringDependencies = {},
) {
  requireAssignmentPermission(context);
  const input = validateAssignStudentMentorInput(value);
  const tenantId = tenant(context);
  const student = await (await students(deps)).getById(tenantId, input.studentId);
  if (!student || student.student.status !== "ACTIVE" || student.enrollment.status !== "ACTIVE")
    throw new NotFoundError("active student enrollment was not found");
  if (student.enrollment.academicYearId !== input.academicYearId)
    throw new ConflictError("student is not enrolled in the selected academic year");
  const planning = store(deps);
  const responsibilities = await planning.list("academic_responsibilities", tenantId, {
    employeeId: input.mentorEmployeeId,
    academicYearId: input.academicYearId,
    campusId: student.enrollment.campusId,
    responsibilityType: "MENTOR",
    status: "ACTIVE",
  });
  if (!responsibilities.length)
    throw new ConflictError(
      "employee does not have an active mentor responsibility for this campus and academic year",
    );
  const repository = records(deps);
  const current = await repository.findActiveAssignment(
    tenantId,
    input.studentId,
    input.academicYearId,
  );
  if (current?.mentorEmployeeId === input.mentorEmployeeId) return current;
  if (current) throw new ConflictError("student already has an active mentor assignment");
  const now = timestamp(deps);
  const userId = actor(context);
  return repository.saveAssignment({
    id: `mentor_assignment_${crypto.randomUUID()}`,
    tenantId,
    academicYearId: input.academicYearId,
    campusId: student.enrollment.campusId,
    mentorEmployeeId: input.mentorEmployeeId,
    studentId: input.studentId,
    effectiveFrom: input.effectiveFrom,
    ...(input.effectiveUntil ? { effectiveUntil: input.effectiveUntil } : {}),
    status: "ACTIVE",
    version: 1,
    createdBy: userId,
    createdAt: now,
    updatedBy: userId,
    updatedAt: now,
  });
}
