import type { RequestContext } from "@school-erp/api";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@school-erp/errors";
import { planningStore, type PlanningStore } from "../planning-store/planning-store.repository";
import { planningReferenceReader } from "../planning-store/planning-reference.repository";
import { studentRepository, type StudentRepository } from "../students/students.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type { WorkloadAssignmentView } from "../teacher-workload/teacher-workload.model";
import { assessmentRepository, type AssessmentRepository } from "./assessments.repository";
import type {
  AssessmentDefinitionRecord,
  MarksSheetStudentEntry,
  TeacherMarksOffering,
  TeacherMarksStudent,
  TeacherMarksWorkspace,
} from "./assessments.model";
import {
  validateAssessmentDefinitionInput,
  validateAssessmentStatus,
  validateSaveTeacherMarksInput,
  validateTeacherMarksWorkspaceInput,
} from "./assessments.validator";

export interface AssessmentServiceDependencies extends TeacherWorkloadDependencies {
  repository?: AssessmentRepository;
  students?: StudentRepository | Promise<StudentRepository>;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
  now?: () => Date;
}

function tenant(context: RequestContext) {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
}

function actor(context: RequestContext) {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new ForbiddenError("authenticated user is required");
  return value;
}

function requireAssessmentManager(context: RequestContext) {
  const user = context.authContext?.user;
  if (user?.role === "TENANT_ADMIN" || user?.permissions.includes("academics.assessment.manage"))
    return;
  throw new ForbiddenError("permission academics.assessment.manage is required");
}

const assignmentOffering = (assignment: WorkloadAssignmentView): TeacherMarksOffering => ({
  id: assignment.subjectOfferingId,
  campusId: assignment.campusId,
  campusName: assignment.campusName,
  subjectName: assignment.subjectName,
  ...(assignment.classId ? { classId: assignment.classId } : {}),
  ...(assignment.className ? { className: assignment.className } : {}),
  ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
  ...(assignment.sectionName ? { sectionName: assignment.sectionName } : {}),
  ...(assignment.subjectBatchId ? { subjectBatchId: assignment.subjectBatchId } : {}),
  ...(assignment.subjectBatchName ? { subjectBatchName: assignment.subjectBatchName } : {}),
});

async function roster(
  tenantId: string,
  offering: TeacherMarksOffering,
  academicYearId: string,
  students: StudentRepository,
  store: PlanningStore,
) {
  if (offering.sectionId) {
    return students.list(tenantId, {
      campusId: offering.campusId,
      academicYearId,
      sectionId: offering.sectionId,
      status: "ACTIVE",
      limit: 500,
    });
  }
  if (!offering.subjectBatchId) return [];
  const memberships = await store.list("subject_batch_memberships", tenantId, {
    subjectBatchId: offering.subjectBatchId,
    status: "ACTIVE",
  });
  const rows = await Promise.all(
    memberships.map((membership) => students.getById(tenantId, String(membership.studentId))),
  );
  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

async function attendanceByStudent(
  tenantId: string,
  offeringId: string,
  assessment: AssessmentDefinitionRecord,
  store: PlanningStore,
) {
  const sessions = (
    await store.list("attendance_sessions", tenantId, {
      subjectOfferingId: offeringId,
      status: "SUBMITTED",
    })
  ).filter((session) => {
    const date = String(session.date);
    return date >= assessment.attendanceWindowStart && date <= assessment.attendanceWindowEnd;
  });
  const totals = new Map<string, { attended: number; held: number }>();
  for (const session of sessions) {
    const entries = Array.isArray(session.students) ? session.students : [];
    for (const value of entries) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entry = value as Record<string, unknown>;
      const studentId = typeof entry.studentId === "string" ? entry.studentId : "";
      if (!studentId) continue;
      const current = totals.get(studentId) ?? { attended: 0, held: 0 };
      current.held += 1;
      if (entry.status === "PRESENT") current.attended += 1;
      totals.set(studentId, current);
    }
  }
  return totals;
}

function marksSummary(students: TeacherMarksStudent[]) {
  const marks = students
    .filter((student) => student.status === "RECORDED" && student.marks !== undefined)
    .map((student) => student.marks!);
  return {
    students: students.length,
    recorded: marks.length,
    absent: students.filter((student) => student.status === "ABSENT").length,
    pending: students.filter((student) => student.status === "NOT_RECORDED").length,
    ...(marks.length
      ? {
          averageMarks:
            Math.round((marks.reduce((sum, mark) => sum + mark, 0) * 100) / marks.length) / 100,
          highestMarks: Math.max(...marks),
          lowestMarks: Math.min(...marks),
        }
      : {}),
  };
}

export async function listAssessmentDefinitions(
  value: unknown,
  context: RequestContext,
  deps: AssessmentServiceDependencies = {},
) {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const academicYearId =
    typeof input.academicYearId === "string" ? input.academicYearId.trim() : "";
  if (!academicYearId)
    throw new ValidationError([{ field: "academicYearId", message: "academicYearId is required" }]);
  const campusId = typeof input.campusId === "string" ? input.campusId.trim() : undefined;
  const classId = typeof input.classId === "string" ? input.classId.trim() : undefined;
  const rows = await (deps.repository ?? assessmentRepository()).listDefinitions(
    tenant(context),
    academicYearId,
  );
  return rows.filter(
    (row) =>
      (!campusId || row.campusId === campusId) &&
      (!classId || !row.classId || row.classId === classId),
  );
}

export async function saveAssessmentDefinition(
  value: unknown,
  context: RequestContext,
  deps: AssessmentServiceDependencies = {},
) {
  requireAssessmentManager(context);
  const input = validateAssessmentDefinitionInput(value);
  const repository = deps.repository ?? assessmentRepository();
  const tenantId = tenant(context);
  const userId = actor(context);
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  const existing = input.id ? await repository.getDefinition(tenantId, input.id) : null;
  if (input.id && !existing) throw new NotFoundError("assessment definition was not found");
  if (existing && existing.status !== "DRAFT") {
    throw new ConflictError("only a draft assessment definition can be edited");
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version) {
    throw new ConflictError("assessment definition version is stale");
  }
  const record: AssessmentDefinitionRecord = {
    id: existing?.id ?? `assessment_${crypto.randomUUID()}`,
    tenantId,
    campusId: input.campusId,
    academicYearId: input.academicYearId,
    ...(input.classId ? { classId: input.classId } : {}),
    name: input.name,
    assessmentDate: input.assessmentDate,
    attendanceWindowStart: input.attendanceWindowStart,
    attendanceWindowEnd: input.attendanceWindowEnd,
    maximumMarks: input.maximumMarks,
    sequence: input.sequence,
    status: "DRAFT",
    version: (existing?.version ?? 0) + 1,
    createdBy: existing?.createdBy ?? userId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedBy: userId,
    updatedAt: timestamp,
  };
  return repository.saveDefinition(record, existing?.version);
}

export async function setAssessmentDefinitionStatus(
  value: unknown,
  context: RequestContext,
  deps: AssessmentServiceDependencies = {},
) {
  requireAssessmentManager(context);
  const input = validateAssessmentStatus(value);
  const repository = deps.repository ?? assessmentRepository();
  const tenantId = tenant(context);
  const existing = await repository.getDefinition(tenantId, input.id);
  if (!existing) throw new NotFoundError("assessment definition was not found");
  if (existing.version !== input.expectedVersion)
    throw new ConflictError("assessment definition version is stale");
  const allowed =
    (existing.status === "DRAFT" && input.status === "OPEN") ||
    (existing.status === "OPEN" && input.status === "CLOSED");
  if (!allowed)
    throw new ConflictError(`assessment cannot move from ${existing.status} to ${input.status}`);
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  return repository.saveDefinition(
    {
      ...existing,
      status: input.status,
      version: existing.version + 1,
      updatedBy: actor(context),
      updatedAt: timestamp,
    },
    existing.version,
  );
}

async function marksWorkspace(
  value: unknown,
  context: RequestContext,
  deps: AssessmentServiceDependencies,
): Promise<TeacherMarksWorkspace> {
  const input = validateTeacherMarksWorkspaceInput(value);
  const store = deps.store ?? planningStore();
  const references =
    deps.references ?? (deps.workspaceReader ? undefined : planningReferenceReader());
  const workload = await (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    {
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      viewMode: "PUBLISHED",
    },
    context,
    { store, ...(references ? { references } : {}) },
  );
  const offerings = [
    ...new Map(
      workload.assignments
        .filter((assignment) => !input.campusId || assignment.campusId === input.campusId)
        .map((assignment) => [assignment.subjectOfferingId, assignmentOffering(assignment)]),
    ).values(),
  ];
  const selectedOffering = input.subjectOfferingId
    ? offerings.find((offering) => offering.id === input.subjectOfferingId)
    : offerings[0];
  if (input.subjectOfferingId && !selectedOffering)
    throw new ForbiddenError("subject offering is not assigned to this teacher");
  if (!selectedOffering) {
    return {
      teacher: { id: workload.teacher.id, name: workload.teacher.fullName },
      academicYear: workload.academicYear,
      offerings,
      assessments: [],
      students: [],
      summary: marksSummary([]),
      canEdit: false,
    };
  }
  const repository = deps.repository ?? assessmentRepository();
  const definitions = await repository.listDefinitions(tenant(context), workload.academicYear.id);
  const assessments = definitions.filter(
    (definition) =>
      definition.status !== "DRAFT" &&
      definition.campusId === selectedOffering.campusId &&
      (!definition.classId || definition.classId === selectedOffering.classId),
  );
  const selectedAssessment = input.assessmentId
    ? assessments.find((assessment) => assessment.id === input.assessmentId)
    : (assessments.find((assessment) => assessment.status === "OPEN") ?? assessments[0]);
  if (input.assessmentId && !selectedAssessment)
    throw new NotFoundError("assessment is not available for the selected offering");
  if (!selectedAssessment) {
    return {
      teacher: { id: workload.teacher.id, name: workload.teacher.fullName },
      academicYear: workload.academicYear,
      offerings,
      assessments,
      selectedOffering,
      students: [],
      summary: marksSummary([]),
      canEdit: false,
    };
  }
  const tenantId = tenant(context);
  const studentRows = await roster(
    tenantId,
    selectedOffering,
    workload.academicYear.id,
    await (deps.students ?? studentRepository()),
    store,
  );
  const sheet = await repository.findSheet(
    tenantId,
    workload.teacher.id,
    selectedAssessment.id,
    selectedOffering.id,
  );
  const existingMarks = new Map(sheet?.students.map((entry) => [entry.studentId, entry]));
  const attendance = await attendanceByStudent(
    tenantId,
    selectedOffering.id,
    selectedAssessment,
    store,
  );
  const students: TeacherMarksStudent[] = studentRows
    .map(({ student, enrollment }) => {
      const existing = existingMarks.get(student.id);
      const total = attendance.get(student.id) ?? { attended: 0, held: 0 };
      return {
        studentId: student.id,
        enrollmentId: enrollment.id,
        studentName: student.name,
        registrationNumber: student.registrationNumber,
        ...(enrollment.rollNumber ? { rollNumber: enrollment.rollNumber } : {}),
        status: existing?.status ?? "NOT_RECORDED",
        ...(existing?.marks !== undefined ? { marks: existing.marks } : {}),
        attendanceAttended: total.attended,
        attendanceHeld: total.held,
        ...(total.held
          ? { attendancePercentage: Math.round((total.attended * 100) / total.held) }
          : {}),
      };
    })
    .sort(
      (left, right) =>
        (left.rollNumber ?? "").localeCompare(right.rollNumber ?? "", undefined, {
          numeric: true,
        }) || left.studentName.localeCompare(right.studentName),
    );
  return {
    teacher: { id: workload.teacher.id, name: workload.teacher.fullName },
    academicYear: workload.academicYear,
    offerings,
    assessments,
    selectedOffering,
    selectedAssessment,
    ...(sheet ? { sheet } : {}),
    students,
    summary: marksSummary(students),
    canEdit: selectedAssessment.status === "OPEN" && sheet?.status !== "SUBMITTED",
  };
}

export function getTeacherMarksWorkspace(
  value: unknown,
  context: RequestContext,
  deps: AssessmentServiceDependencies = {},
) {
  return marksWorkspace(value, context, deps);
}

export async function saveTeacherMarks(
  value: unknown,
  context: RequestContext,
  deps: AssessmentServiceDependencies = {},
) {
  const input = validateSaveTeacherMarksInput(value);
  const workspace = await marksWorkspace(input, context, deps);
  const offering = workspace.selectedOffering;
  const assessment = workspace.selectedAssessment;
  if (!offering || !assessment) throw new NotFoundError("marks workspace is not available");
  if (!workspace.canEdit) throw new ConflictError("marks entry is closed or already submitted");
  if (input.expectedVersion !== undefined && input.expectedVersion !== workspace.sheet?.version) {
    throw new ConflictError("marks sheet version is stale");
  }
  const rosterById = new Map(workspace.students.map((student) => [student.studentId, student]));
  if (
    input.students.length !== rosterById.size ||
    input.students.some((entry) => !rosterById.has(entry.studentId))
  ) {
    throw new ValidationError([
      {
        field: "students",
        message: "marks must include every active student in the assigned group",
      },
    ]);
  }
  for (const entry of input.students) {
    if (entry.status === "RECORDED" && Number(entry.marks) > assessment.maximumMarks) {
      throw new ValidationError([
        { field: "students.marks", message: `marks cannot exceed ${assessment.maximumMarks}` },
      ]);
    }
    if (input.submit && entry.status === "NOT_RECORDED") {
      throw new ValidationError([
        {
          field: "students.status",
          message: "every student must be recorded or marked absent before submission",
        },
      ]);
    }
  }
  const inputByStudent = new Map(input.students.map((entry) => [entry.studentId, entry]));
  const students: MarksSheetStudentEntry[] = workspace.students.map((student) => {
    const entry = inputByStudent.get(student.studentId)!;
    return {
      studentId: student.studentId,
      enrollmentId: student.enrollmentId,
      studentName: student.studentName,
      ...(student.rollNumber ? { rollNumber: student.rollNumber } : {}),
      status: entry.status,
      ...(entry.status === "RECORDED" ? { marks: Number(entry.marks) } : {}),
    };
  });
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  const userId = actor(context);
  const existing = workspace.sheet;
  const record = {
    id: existing?.id ?? `marks_sheet_${crypto.randomUUID()}`,
    tenantId: tenant(context),
    employeeId: workspace.teacher.id,
    academicYearId: workspace.academicYear.id,
    campusId: offering.campusId,
    assessmentId: assessment.id,
    subjectOfferingId: offering.id,
    subjectName: offering.subjectName,
    ...(offering.className ? { className: offering.className } : {}),
    ...(offering.sectionName ? { sectionName: offering.sectionName } : {}),
    ...(offering.sectionId ? { sectionId: offering.sectionId } : {}),
    ...(offering.subjectBatchId ? { subjectBatchId: offering.subjectBatchId } : {}),
    status: input.submit ? ("SUBMITTED" as const) : ("DRAFT" as const),
    students,
    version: (existing?.version ?? 0) + 1,
    createdBy: existing?.createdBy ?? userId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedBy: userId,
    updatedAt: timestamp,
    ...(input.submit ? { submittedBy: userId, submittedAt: timestamp } : {}),
  };
  return (deps.repository ?? assessmentRepository()).saveSheet(record, existing?.version);
}
