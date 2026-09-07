import type { RequestContext } from "@school-erp/api";
import { BadRequestError, NotFoundError } from "@school-erp/errors";
import { studentRepository, type StudentRepository } from "../students/students.repository";
import { planningStore, type PlanningStore } from "../planning-store/planning-store.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type { TeacherClassStudentView, TeacherClassWorkspace } from "./teacher-classes.model";
import { validateTeacherClassWorkspaceInput } from "./teacher-classes.validator";

export interface TeacherClassDependencies extends TeacherWorkloadDependencies {
  students?: StudentRepository | Promise<StudentRepository>;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
}

const tenant = (context: RequestContext) => {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
};

function mapStudent(
  row: NonNullable<Awaited<ReturnType<StudentRepository["getById"]>>>,
): TeacherClassStudentView {
  return {
    studentId: row.student.id,
    studentName: row.student.name,
    admissionNumber: row.student.admissionNumber,
    registrationNumber: row.student.registrationNumber,
    ...(row.enrollment.rollNumber ? { rollNumber: row.enrollment.rollNumber } : {}),
    status: row.student.status,
  };
}

async function assignedRoster(
  tenantId: string,
  workspace: Awaited<ReturnType<typeof getTeacherWorkloadWorkspace>>,
  assignment: TeacherClassWorkspace["assignment"],
  students: StudentRepository,
  store: PlanningStore,
) {
  if (assignment.sectionId) {
    return students.list(tenantId, {
      campusId: assignment.campusId,
      academicYearId: workspace.academicYear.id,
      ...(assignment.classId ? { classId: assignment.classId } : {}),
      sectionId: assignment.sectionId,
      status: "ACTIVE",
      limit: 500,
    });
  }
  if (!assignment.subjectBatchId) return [];
  const memberships = await store.list("subject_batch_memberships", tenantId, {
    subjectBatchId: assignment.subjectBatchId,
    status: "ACTIVE",
  });
  const rows = await Promise.all(
    memberships.map((membership) => students.getById(tenantId, String(membership.studentId))),
  );
  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function getTeacherClassWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherClassDependencies = {},
): Promise<TeacherClassWorkspace> {
  const input = validateTeacherClassWorkspaceInput(value);
  const store = deps.store ?? planningStore();
  const workspace = await (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    {
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      viewMode: "PUBLISHED",
    },
    context,
    deps,
  );
  const assignment = workspace.assignments.find(
    (item) => item.subjectOfferingId === input.subjectOfferingId,
  );
  if (!assignment) throw new NotFoundError("assigned class and subject were not found");
  const rows = await assignedRoster(
    tenant(context),
    workspace,
    assignment,
    await (deps.students ?? studentRepository()),
    store,
  );
  const students = rows.map(mapStudent).sort(
    (left, right) =>
      (left.rollNumber ?? "").localeCompare(right.rollNumber ?? "", undefined, {
        numeric: true,
      }) || left.studentName.localeCompare(right.studentName),
  );
  return {
    teacher: workspace.teacher,
    academicYear: workspace.academicYear,
    assignment,
    students,
    timetableEntries: workspace.timetableEntries
      .filter(
        (entry) =>
          entry.subjectOfferingId === assignment.subjectOfferingId && entry.state !== "CANCELLED",
      )
      .sort(
        (left, right) =>
          left.dayOfWeek.localeCompare(right.dayOfWeek) ||
          left.startTime.localeCompare(right.startTime),
      ),
  };
}
