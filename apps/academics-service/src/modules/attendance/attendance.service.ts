import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@school-erp/errors";
import { studentRepository, type StudentRepository } from "../students/students.repository";
import { planningStore } from "../planning-store/planning-store.repository";
import { planningReferenceReader } from "../planning-store/planning-reference.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type { TeacherWorkloadWorkspace } from "../teacher-workload/teacher-workload.model";
import { attendanceRepository, type AttendanceRepository } from "./attendance.repository";
import type {
  AttendanceStudentEntry,
  SaveTeacherAttendanceInput,
  TeacherAttendanceSessionView,
  TeacherAttendanceWorkspace,
} from "./attendance.model";
import {
  validateSaveTeacherAttendanceInput,
  validateTeacherAttendanceWorkspaceInput,
} from "./attendance.validator";

export interface AttendanceServiceDependencies extends TeacherWorkloadDependencies {
  repository?: AttendanceRepository;
  students?: StudentRepository | Promise<StudentRepository>;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
  now?: () => Date;
}

function actor(context: RequestContext) {
  const value = context.authContext?.user?.id?.trim();
  if (!value)
    throw new ValidationError([{ field: "auth", message: "authenticated user is required" }]);
  return value;
}

function tenant(context: RequestContext) {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
}

const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const dayForDate = (date: string) => dayNames[new Date(`${date}T00:00:00.000Z`).getUTCDay()]!;

function sessionView(
  item: TeacherWorkloadWorkspace["timetableEntries"][number],
  academicYearId: string,
): TeacherAttendanceSessionView {
  return {
    id: item.id,
    timetableEntryId: item.sourceTimetableEntryId,
    timetableVersionId: item.timetableVersionId,
    campusId: item.campusId,
    campusName: item.campusName,
    academicYearId,
    subjectOfferingId: item.subjectOfferingId,
    ...(item.sectionId ? { sectionId: item.sectionId } : {}),
    ...(item.subjectBatchId ? { subjectBatchId: item.subjectBatchId } : {}),
    ...(item.teachingGroupId ? { teachingGroupId: item.teachingGroupId } : {}),
    subjectName: item.subjectName,
    ...(item.className ? { className: item.className } : {}),
    ...(item.sectionName ? { sectionName: item.sectionName } : {}),
    startTime: item.startTime,
    endTime: item.endTime,
    state: item.state === "SUBSTITUTION" ? "SUBSTITUTION" : "PERMANENT",
  };
}

async function roster(
  tenantId: string,
  session: TeacherAttendanceSessionView,
  students: StudentRepository,
  workloadDeps: TeacherWorkloadDependencies,
) {
  if (session.sectionId) {
    return students.list(tenantId, {
      campusId: session.campusId,
      academicYearId: session.academicYearId,
      sectionId: session.sectionId,
      status: "ACTIVE",
      limit: 500,
    });
  }
  const store = workloadDeps.store;
  if (!store) throw new Error("attendance roster store is required");
  const memberships = session.subjectBatchId
    ? await store.list("subject_batch_memberships", tenantId, {
        subjectBatchId: session.subjectBatchId,
        status: "ACTIVE",
      })
    : session.teachingGroupId
      ? await store.list("teaching_group_memberships", tenantId, {
          teachingGroupId: session.teachingGroupId,
          status: "ACTIVE",
        })
      : [];
  const rows = await Promise.all(
    memberships.map((item) => students.getById(tenantId, String(item.studentId))),
  );
  return rows.filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function mapRoster(
  rows: Awaited<ReturnType<StudentRepository["list"]>>,
  existing: Map<string, "PRESENT" | "ABSENT">,
): AttendanceStudentEntry[] {
  return rows
    .map(({ student, enrollment }) => ({
      studentId: student.id,
      enrollmentId: enrollment.id,
      studentName: student.name,
      ...(enrollment.rollNumber ? { rollNumber: enrollment.rollNumber } : {}),
      status: existing.get(student.id) ?? ("PRESENT" as const),
    }))
    .sort(
      (left, right) =>
        (left.rollNumber ?? "").localeCompare(right.rollNumber ?? "", undefined, {
          numeric: true,
        }) || left.studentName.localeCompare(right.studentName),
    );
}

async function workspace(
  value: unknown,
  context: RequestContext,
  deps: AttendanceServiceDependencies,
): Promise<TeacherAttendanceWorkspace> {
  const input = validateTeacherAttendanceWorkspaceInput(value);
  const tenantId = tenant(context);
  const readWorkspace = deps.workspaceReader ?? getTeacherWorkloadWorkspace;
  const store = deps.store ?? planningStore();
  const references =
    deps.references ?? (deps.workspaceReader ? undefined : planningReferenceReader());
  const workload = await readWorkspace(
    {
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      viewMode: "PUBLISHED",
      weekStartDate: input.date,
    },
    context,
    { store, ...(references ? { references } : {}) },
  );
  const sessions = workload.timetableEntries
    .filter((item) => item.dayOfWeek === dayForDate(input.date) && item.state !== "CANCELLED")
    .map((item) => sessionView(item, workload.academicYear.id))
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const selectedSession = input.lessonId
    ? sessions.find((item) => item.id === input.lessonId)
    : sessions[0];
  if (input.lessonId && !selectedSession)
    throw new NotFoundError("assigned attendance session was not found");
  if (!selectedSession) {
    return {
      date: input.date,
      teacherId: workload.teacher.id,
      teacherName: workload.teacher.fullName,
      academicYear: { id: workload.academicYear.id, name: workload.academicYear.name },
      sessions,
      students: [],
      canEdit: false,
    };
  }
  const repository = deps.repository ?? attendanceRepository();
  const attendance = await repository.findByLesson(
    tenantId,
    workload.teacher.id,
    input.date,
    selectedSession.id,
  );
  const studentRows = await roster(
    tenantId,
    selectedSession,
    await (deps.students ?? studentRepository()),
    { store },
  );
  const statuses = new Map(attendance?.students.map((item) => [item.studentId, item.status]));
  return {
    date: input.date,
    teacherId: workload.teacher.id,
    teacherName: workload.teacher.fullName,
    academicYear: { id: workload.academicYear.id, name: workload.academicYear.name },
    sessions,
    selectedSession,
    ...(attendance ? { attendance } : {}),
    students: mapRoster(studentRows, statuses),
    canEdit: attendance?.status !== "SUBMITTED",
  };
}

export function getTeacherAttendanceWorkspace(
  value: unknown,
  context: RequestContext,
  deps: AttendanceServiceDependencies = {},
) {
  return workspace(value, context, deps);
}

export async function saveTeacherAttendance(
  value: unknown,
  context: RequestContext,
  deps: AttendanceServiceDependencies = {},
) {
  const input: SaveTeacherAttendanceInput = validateSaveTeacherAttendanceInput(value);
  const currentWorkspace = await workspace(input, context, deps);
  const session = currentWorkspace.selectedSession;
  if (!session) throw new NotFoundError("assigned attendance session was not found");
  const existing = currentWorkspace.attendance;
  if (existing?.status === "SUBMITTED") {
    throw new ConflictError("submitted attendance is locked; create a correction request");
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version) {
    throw new ConflictError("attendance version is stale");
  }
  const rosterById = new Map(currentWorkspace.students.map((item) => [item.studentId, item]));
  if (
    input.students.length !== rosterById.size ||
    input.students.some((item) => !rosterById.has(item.studentId))
  ) {
    throw new ValidationError([
      {
        field: "students",
        message: "attendance must include every active student in the assigned group",
      },
    ]);
  }
  const statuses = new Map(input.students.map((item) => [item.studentId, item.status]));
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  const userId = actor(context);
  const record = {
    id: existing?.id ?? `attendance_${crypto.randomUUID()}`,
    tenantId: tenant(context),
    employeeId: currentWorkspace.teacherId,
    academicYearId: currentWorkspace.academicYear.id,
    campusId: session.campusId,
    date: input.date,
    lessonId: session.id,
    timetableEntryId: session.timetableEntryId,
    timetableVersionId: session.timetableVersionId,
    subjectOfferingId: session.subjectOfferingId,
    ...(session.sectionId ? { sectionId: session.sectionId } : {}),
    ...(session.subjectBatchId ? { subjectBatchId: session.subjectBatchId } : {}),
    ...(session.teachingGroupId ? { teachingGroupId: session.teachingGroupId } : {}),
    subjectName: session.subjectName,
    ...(session.className ? { className: session.className } : {}),
    ...(session.sectionName ? { sectionName: session.sectionName } : {}),
    startTime: session.startTime,
    endTime: session.endTime,
    status: input.submit ? ("SUBMITTED" as const) : ("DRAFT" as const),
    students: currentWorkspace.students.map((student) => ({
      ...student,
      status: statuses.get(student.studentId)!,
    })),
    version: (existing?.version ?? 0) + 1,
    createdBy: existing?.createdBy ?? userId,
    createdAt: existing?.createdAt ?? timestamp,
    updatedBy: userId,
    updatedAt: timestamp,
    ...(input.submit ? { submittedBy: userId, submittedAt: timestamp } : {}),
  };
  return (deps.repository ?? attendanceRepository()).save(record, existing?.version);
}
