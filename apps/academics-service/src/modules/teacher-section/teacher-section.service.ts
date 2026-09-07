import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import {
  planningReferenceReader,
  type PlanningReferenceReader,
} from "../planning-store/planning-reference.repository";
import {
  planningStore,
  type PlanningDocument,
  type PlanningStore,
} from "../planning-store/planning-store.repository";
import { studentRepository, type StudentRepository } from "../students/students.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type {
  TeacherSectionTimetableEntry,
  TeacherSectionWorkspace,
} from "./teacher-section.model";
import {
  teacherSectionRepository,
  type TeacherSectionRepository,
} from "./teacher-section.repository";
import {
  validateResolveSectionFollowUpInput,
  validateSaveSectionFollowUpInput,
  validateTeacherSectionInput,
} from "./teacher-section.validator";

export interface TeacherSectionDependencies extends TeacherWorkloadDependencies {
  repository?: TeacherSectionRepository;
  students?: StudentRepository;
  planning?: PlanningStore;
  referenceReader?: PlanningReferenceReader;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
  now?: () => Date;
}
const tenant = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
};
const actor = (context: RequestContext) => {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new ForbiddenError("authenticated user is required");
  return value;
};
const timestamp = (deps: TeacherSectionDependencies) =>
  (deps.now ?? (() => new Date()))().toISOString();
const repo = (deps: TeacherSectionDependencies) => deps.repository ?? teacherSectionRepository();
const studentStore = async (deps: TeacherSectionDependencies) =>
  deps.students ?? (await studentRepository());
const plan = (deps: TeacherSectionDependencies) => deps.planning ?? deps.store ?? planningStore();
const refs = (deps: TeacherSectionDependencies) =>
  deps.referenceReader ?? deps.references ?? planningReferenceReader();
const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

async function scopedSection(
  value: unknown,
  context: RequestContext,
  deps: TeacherSectionDependencies,
) {
  const input = validateTeacherSectionInput(value);
  const workspace = await (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    {
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      viewMode: "PUBLISHED",
    },
    context,
    deps,
  );
  const available = workspace.responsibilities.filter(
    (item) =>
      ["CLASS_TEACHER", "SECTION_INCHARGE"].includes(item.responsibilityType) &&
      item.sectionId &&
      item.classId,
  );
  const selected = input.sectionId
    ? available.find((item) => item.sectionId === input.sectionId)
    : available[0];
  if (!selected?.sectionId || !selected.classId)
    throw new NotFoundError("assigned section responsibility was not found");
  return { input, workspace, selected, available };
}

function subjectName(
  offering: PlanningDocument,
  records: {
    components: PlanningDocument[];
    curricula: PlanningDocument[];
    catalogue: PlanningDocument[];
  },
) {
  const component = records.components.find((item) => item.id === offering.subjectComponentId);
  const curriculum = records.curricula.find(
    (item) => item.id === (offering.curriculumSubjectId ?? component?.curriculumSubjectId),
  );
  const catalogue = records.catalogue.find((item) => item.id === curriculum?.subjectCatalogueId);
  return text(catalogue?.name || offering.subjectName) || "Subject";
}

async function sectionTimetable(
  tenantId: string,
  academicYearId: string,
  sectionId: string,
  deps: TeacherSectionDependencies,
): Promise<TeacherSectionTimetableEntry[]> {
  const store = plan(deps);
  const versions = (
    await store.list("timetable_versions", tenantId, {
      academicYearId,
      sectionId,
      status: "PUBLISHED",
    })
  ).sort((a, b) => Number(b.versionNumber ?? 0) - Number(a.versionNumber ?? 0));
  const version = versions[0];
  if (!version) return [];
  const [entries, slots, offerings, assignments, components, curricula, catalogue] =
    await Promise.all([
      store.list("timetable_entries", tenantId, {
        timetableVersionId: version.id,
        status: "ACTIVE",
      }),
      store.list("timetable_period_slots", tenantId, { status: "ACTIVE" }),
      store.list("subject_offerings", tenantId, { status: "ACTIVE" }),
      store.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }),
      store.list("subject_components", tenantId, { status: "ACTIVE" }),
      store.list("curriculum_subjects", tenantId, { status: "ACTIVE" }),
      store.list("subject_catalogue", tenantId, { status: "ACTIVE" }),
    ]);
  const employeeIds = [
    ...new Set(
      entries
        .flatMap((entry) => list(entry.teachingAssignmentIds))
        .map((id) => assignments.find((item) => item.id === id))
        .map((item) => text(item?.employeeId))
        .filter(Boolean),
    ),
  ];
  const employeePairs = await Promise.all(
    employeeIds.map(async (id) => {
      try {
        const employee = await refs(deps).getEmployee(tenantId, id);
        return [id, text(employee.fullName || employee.name) || "Assigned teacher"] as const;
      } catch {
        return [id, "Assigned teacher"] as const;
      }
    }),
  );
  const employeeNames = new Map(employeePairs);
  return entries
    .flatMap((entry) => {
      const slotRecords = list(entry.periodSlotIds)
        .map((id) => slots.find((slot) => slot.id === id))
        .filter((slot): slot is PlanningDocument => Boolean(slot));
      const offering = offerings.find((item) => item.id === entry.subjectOfferingId);
      if (!slotRecords.length || !offering) return [];
      const assignment = list(entry.teachingAssignmentIds)
        .map((id) => assignments.find((item) => item.id === id))
        .find(Boolean);
      return [
        {
          id: String(entry.id),
          dayOfWeek: text(entry.dayOfWeek),
          startTime: text(slotRecords[0]?.startTime),
          endTime: text(slotRecords.at(-1)?.endTime),
          subjectName: subjectName(offering, { components, curricula, catalogue }),
          teacherName: employeeNames.get(text(assignment?.employeeId)) ?? "Assigned teacher",
        },
      ];
    })
    .sort(
      (left, right) =>
        days.indexOf(left.dayOfWeek) - days.indexOf(right.dayOfWeek) ||
        left.startTime.localeCompare(right.startTime),
    );
}

export async function getTeacherSectionWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherSectionDependencies = {},
): Promise<TeacherSectionWorkspace> {
  const { input, workspace, selected, available } = await scopedSection(value, context, deps);
  const tenantId = tenant(context),
    sectionId = selected.sectionId!,
    classId = selected.classId!;
  const [studentPage, attendance, marks, timetable, followUps] = await Promise.all([
    (await studentStore(deps)).listPage(tenantId, {
      academicYearId: workspace.academicYear.id,
      campusId: selected.campusId,
      classId,
      sectionId,
      status: "ACTIVE",
      page: 1,
      pageSize: 200,
      sortBy: "name",
      sortDirection: "ASC",
    }),
    plan(deps).list("attendance_sessions", tenantId, {
      academicYearId: workspace.academicYear.id,
      sectionId,
      date: input.date,
    }),
    plan(deps).list("marks_sheets", tenantId, {
      academicYearId: workspace.academicYear.id,
      sectionId,
    }),
    sectionTimetable(tenantId, workspace.academicYear.id, sectionId, deps),
    repo(deps).listFollowUps(tenantId, workspace.teacher.id, workspace.academicYear.id, sectionId),
  ]);
  const submittedAttendance = attendance.filter((item) => item.status === "SUBMITTED");
  const latestStudentStatus = new Map<string, "PRESENT" | "ABSENT">();
  for (const session of submittedAttendance)
    for (const student of Array.isArray(session.students)
      ? (session.students as Array<Record<string, unknown>>)
      : [])
      if (text(student.studentId) && (student.status === "PRESENT" || student.status === "ABSENT"))
        latestStudentStatus.set(text(student.studentId), student.status);
  const openCounts = new Map<string, number>();
  for (const item of followUps.filter((record) => record.status === "OPEN"))
    openCounts.set(item.studentId, (openCounts.get(item.studentId) ?? 0) + 1);
  const students = studentPage.items.map(({ student, enrollment }) => ({
    studentId: student.id,
    studentName: student.name,
    admissionNumber: student.admissionNumber,
    registrationNumber: student.registrationNumber,
    ...(enrollment.rollNumber ? { rollNumber: enrollment.rollNumber } : {}),
    guardianName: student.guardian.name,
    ...(student.guardian.phone ? { guardianPhone: student.guardian.phone } : {}),
    ...(latestStudentStatus.get(student.id)
      ? { attendanceStatusToday: latestStudentStatus.get(student.id)! }
      : {}),
    openFollowUps: openCounts.get(student.id) ?? 0,
  }));
  return {
    section: {
      id: sectionId,
      name: selected.sectionName ?? "Section",
      classId,
      className: selected.className ?? "Class",
      campusId: selected.campusId,
    },
    availableSections: available.map((item) => ({
      id: item.sectionId!,
      name: item.sectionName ?? "Section",
      className: item.className ?? "Class",
      campusId: item.campusId,
    })),
    summary: {
      totalStudents: studentPage.total,
      presentToday: students.filter((item) => item.attendanceStatusToday === "PRESENT").length,
      absentToday: students.filter((item) => item.attendanceStatusToday === "ABSENT").length,
      attendanceSessionsToday: submittedAttendance.length,
      openFollowUps: followUps.filter((item) => item.status === "OPEN").length,
      marksSheetsSubmitted: marks.filter((item) => item.status === "SUBMITTED").length,
      marksSheetsPending: marks.filter((item) => item.status !== "SUBMITTED").length,
    },
    students,
    timetable,
    followUps,
  };
}

export async function saveTeacherSectionFollowUp(
  value: unknown,
  context: RequestContext,
  deps: TeacherSectionDependencies = {},
) {
  const input = validateSaveSectionFollowUpInput(value);
  const { workspace, selected } = await scopedSection(
    { academicYearId: input.academicYearId, sectionId: input.sectionId },
    context,
    deps,
  );
  const tenantId = tenant(context),
    repository = repo(deps);
  const student = await (await studentStore(deps)).getById(tenantId, input.studentId);
  if (
    !student ||
    student.enrollment.sectionId !== selected.sectionId ||
    student.enrollment.academicYearId !== workspace.academicYear.id
  )
    throw new NotFoundError("student was not found in the assigned section");
  const current = input.id ? await repository.getFollowUp(tenantId, input.id) : null;
  if (
    input.id &&
    (!current ||
      current.employeeId !== workspace.teacher.id ||
      current.sectionId !== selected.sectionId)
  )
    throw new NotFoundError("section follow-up was not found");
  if (current && current.status !== "OPEN")
    throw new ConflictError("resolved section follow-up cannot be edited");
  if (input.expectedVersion !== undefined && input.expectedVersion !== current?.version)
    throw new ConflictError("section follow-up version is stale");
  const now = timestamp(deps),
    userId = actor(context);
  return repository.saveFollowUp(
    {
      id: current?.id ?? `section_followup_${crypto.randomUUID()}`,
      tenantId,
      academicYearId: workspace.academicYear.id,
      campusId: selected.campusId,
      classId: selected.classId!,
      sectionId: selected.sectionId!,
      studentId: input.studentId,
      employeeId: workspace.teacher.id,
      followUpType: input.followUpType,
      summary: input.summary,
      ...(input.nextAction ? { nextAction: input.nextAction } : {}),
      ...(input.followUpDate ? { followUpDate: input.followUpDate } : {}),
      visibility: input.visibility,
      status: "OPEN",
      version: (current?.version ?? 0) + 1,
      createdBy: current?.createdBy ?? userId,
      createdAt: current?.createdAt ?? now,
      updatedBy: userId,
      updatedAt: now,
    },
    current?.version,
  );
}

export async function resolveTeacherSectionFollowUp(
  value: unknown,
  context: RequestContext,
  deps: TeacherSectionDependencies = {},
) {
  const input = validateResolveSectionFollowUpInput(value),
    repository = repo(deps),
    tenantId = tenant(context);
  const current = await repository.getFollowUp(tenantId, input.id);
  if (!current) throw new NotFoundError("section follow-up was not found");
  const { workspace } = await scopedSection(
    { academicYearId: current.academicYearId, sectionId: current.sectionId },
    context,
    deps,
  );
  if (current.employeeId !== workspace.teacher.id)
    throw new NotFoundError("section follow-up was not found");
  if (current.version !== input.expectedVersion)
    throw new ConflictError("section follow-up version is stale");
  if (current.status === "RESOLVED") return current;
  const now = timestamp(deps);
  return repository.saveFollowUp(
    {
      ...current,
      status: "RESOLVED",
      resolvedAt: now,
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: now,
    },
    current.version,
  );
}
