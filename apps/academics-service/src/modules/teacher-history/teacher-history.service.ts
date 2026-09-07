import type { RequestContext } from "@school-erp/api";
import { BadRequestError, NotFoundError } from "@school-erp/errors";
import {
  assessmentRepository,
  type AssessmentRepository,
} from "../assessments/assessments.repository";
import {
  attendanceRepository,
  type AttendanceRepository,
} from "../attendance/attendance.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type {
  TeacherAttendanceHistoryItem,
  TeacherHistoryPage,
  TeacherMarksHistoryItem,
} from "./teacher-history.model";
import { validateTeacherHistoryPageInput } from "./teacher-history.validator";

export interface TeacherHistoryDependencies extends TeacherWorkloadDependencies {
  attendance?: AttendanceRepository;
  assessments?: AssessmentRepository;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
}

const tenant = (context: RequestContext) => {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
};

const page = <Item>(
  items: Item[],
  current: number,
  pageSize: number,
): TeacherHistoryPage<Item> => ({
  items: items.slice((current - 1) * pageSize, current * pageSize),
  page: current,
  pageSize,
  total: items.length,
  totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
});

async function scope(value: unknown, context: RequestContext, deps: TeacherHistoryDependencies) {
  const input = validateTeacherHistoryPageInput(value);
  const workspace = await (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    {
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      viewMode: "PUBLISHED",
    },
    context,
    deps,
  );
  if (
    input.subjectOfferingId &&
    !workspace.assignments.some(
      (assignment) => assignment.subjectOfferingId === input.subjectOfferingId,
    )
  ) {
    throw new NotFoundError("assigned subject offering was not found");
  }
  return { input, workspace };
}

export async function listTeacherAttendanceHistory(
  value: unknown,
  context: RequestContext,
  deps: TeacherHistoryDependencies = {},
) {
  const { input, workspace } = await scope(value, context, deps);
  const records = await (deps.attendance ?? attendanceRepository()).listByTeacher(
    tenant(context),
    workspace.teacher.id,
    workspace.academicYear.id,
  );
  const items: TeacherAttendanceHistoryItem[] = records
    .filter(
      (record) =>
        (!input.subjectOfferingId || record.subjectOfferingId === input.subjectOfferingId) &&
        (!input.status || record.status === input.status),
    )
    .map((record) => ({
      id: record.id,
      date: record.date,
      subjectOfferingId: record.subjectOfferingId,
      subjectName: record.subjectName,
      ...(record.className ? { className: record.className } : {}),
      ...(record.sectionName ? { sectionName: record.sectionName } : {}),
      startTime: record.startTime,
      endTime: record.endTime,
      status: record.status,
      studentCount: record.students.length,
      presentCount: record.students.filter((student) => student.status === "PRESENT").length,
      absentCount: record.students.filter((student) => student.status === "ABSENT").length,
      ...(record.submittedAt ? { submittedAt: record.submittedAt } : {}),
    }));
  return page(items, input.page, input.pageSize);
}

export async function listTeacherMarksHistory(
  value: unknown,
  context: RequestContext,
  deps: TeacherHistoryDependencies = {},
) {
  const { input, workspace } = await scope(value, context, deps);
  const repository = deps.assessments ?? assessmentRepository();
  const [records, definitions] = await Promise.all([
    repository.listSheets(tenant(context), workspace.teacher.id, workspace.academicYear.id),
    repository.listDefinitions(tenant(context), workspace.academicYear.id),
  ]);
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const items: TeacherMarksHistoryItem[] = records
    .filter(
      (record) =>
        (!input.subjectOfferingId || record.subjectOfferingId === input.subjectOfferingId) &&
        (!input.status || record.status === input.status),
    )
    .map((record) => {
      const definition = definitionsById.get(record.assessmentId);
      return {
        id: record.id,
        assessmentId: record.assessmentId,
        assessmentName: definition?.name ?? "Assessment",
        maximumMarks: definition?.maximumMarks ?? 0,
        subjectOfferingId: record.subjectOfferingId,
        subjectName: record.subjectName,
        ...(record.className ? { className: record.className } : {}),
        ...(record.sectionName ? { sectionName: record.sectionName } : {}),
        status: record.status,
        studentCount: record.students.length,
        recordedCount: record.students.filter((student) => student.status === "RECORDED").length,
        absentCount: record.students.filter((student) => student.status === "ABSENT").length,
        pendingCount: record.students.filter((student) => student.status === "NOT_RECORDED").length,
        ...(record.submittedAt ? { submittedAt: record.submittedAt } : {}),
        updatedAt: record.updatedAt,
      };
    });
  return page(items, input.page, input.pageSize);
}
