import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@school-erp/errors";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import {
  dailyStudentUpdateRepository,
  type DailyStudentUpdateRepository,
} from "./daily-student-updates.repository";
import {
  validateDailyStudentUpdatePageInput,
  validateDailyStudentUpdateTransitionInput,
  validateSaveDailyStudentUpdateInput,
} from "./daily-student-updates.validator";

export interface DailyStudentUpdateDependencies extends TeacherWorkloadDependencies {
  repository?: DailyStudentUpdateRepository;
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
  if (!value)
    throw new ValidationError([{ field: "auth", message: "authenticated user is required" }]);
  return value;
}

async function teacherWorkspace(
  academicYearId: string | undefined,
  context: RequestContext,
  deps: DailyStudentUpdateDependencies,
) {
  return (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    { ...(academicYearId ? { academicYearId } : {}), viewMode: "PUBLISHED" },
    context,
    deps,
  );
}

export async function listTeacherDailyStudentUpdates(
  value: unknown,
  context: RequestContext,
  deps: DailyStudentUpdateDependencies = {},
) {
  const input = validateDailyStudentUpdatePageInput(value);
  const workspace = await teacherWorkspace(input.academicYearId, context, deps);
  if (
    input.subjectOfferingId &&
    !workspace.assignments.some((item) => item.subjectOfferingId === input.subjectOfferingId)
  ) {
    throw new NotFoundError("assigned subject offering was not found");
  }
  return (deps.repository ?? dailyStudentUpdateRepository()).listPage(tenant(context), {
    employeeId: workspace.teacher.id,
    academicYearId: workspace.academicYear.id,
    ...(input.subjectOfferingId ? { subjectOfferingId: input.subjectOfferingId } : {}),
    ...(input.status ? { status: input.status } : {}),
    page: input.page,
    pageSize: input.pageSize,
  });
}

export async function saveTeacherDailyStudentUpdate(
  value: unknown,
  context: RequestContext,
  deps: DailyStudentUpdateDependencies = {},
) {
  const input = validateSaveDailyStudentUpdateInput(value);
  const workspace = await teacherWorkspace(input.academicYearId, context, deps);
  const assignment = workspace.assignments.find(
    (item) => item.subjectOfferingId === input.subjectOfferingId,
  );
  if (!assignment) throw new NotFoundError("assigned subject offering was not found");
  const repository = deps.repository ?? dailyStudentUpdateRepository();
  const tenantId = tenant(context);
  const existing = input.id ? await repository.get(tenantId, input.id) : null;
  if (input.id && !existing) throw new NotFoundError("daily update was not found");
  if (existing && existing.employeeId !== workspace.teacher.id)
    throw new NotFoundError("daily update was not found");
  if (existing && existing.status !== "DRAFT")
    throw new ConflictError("only a draft daily update can be edited");
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version) {
    throw new ConflictError("daily update version is stale");
  }
  const userId = actor(context);
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  return repository.save(
    {
      id: existing?.id ?? `daily_update_${crypto.randomUUID()}`,
      tenantId,
      employeeId: workspace.teacher.id,
      academicYearId: workspace.academicYear.id,
      campusId: assignment.campusId,
      subjectOfferingId: assignment.subjectOfferingId,
      ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
      ...(assignment.subjectBatchId ? { subjectBatchId: assignment.subjectBatchId } : {}),
      subjectName: assignment.subjectName,
      ...(assignment.className ? { className: assignment.className } : {}),
      ...(assignment.sectionName ? { sectionName: assignment.sectionName } : {}),
      updateDate: input.updateDate,
      title: input.title,
      message: input.message,
      audience: "STUDENTS_AND_PARENTS",
      status: "DRAFT",
      version: (existing?.version ?? 0) + 1,
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? timestamp,
      updatedBy: userId,
      updatedAt: timestamp,
    },
    existing?.version,
  );
}

async function transition(
  value: unknown,
  context: RequestContext,
  target: "PUBLISHED" | "ARCHIVED",
  deps: DailyStudentUpdateDependencies,
) {
  const input = validateDailyStudentUpdateTransitionInput(value);
  const repository = deps.repository ?? dailyStudentUpdateRepository();
  const tenantId = tenant(context);
  const existing = await repository.get(tenantId, input.id);
  if (!existing) throw new NotFoundError("daily update was not found");
  const workspace = await teacherWorkspace(existing.academicYearId, context, deps);
  if (existing.employeeId !== workspace.teacher.id)
    throw new NotFoundError("daily update was not found");
  if (existing.version !== input.expectedVersion)
    throw new ConflictError("daily update version is stale");
  if (target === "PUBLISHED" && existing.status !== "DRAFT") {
    throw new ConflictError("only a draft daily update can be published");
  }
  if (target === "ARCHIVED" && existing.status !== "PUBLISHED") {
    throw new ConflictError("only a published daily update can be archived");
  }
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  const userId = actor(context);
  return repository.save(
    {
      ...existing,
      status: target,
      version: existing.version + 1,
      updatedBy: userId,
      updatedAt: timestamp,
      ...(target === "PUBLISHED"
        ? { publishedBy: userId, publishedAt: timestamp }
        : { archivedBy: userId, archivedAt: timestamp }),
    },
    existing.version,
  );
}

export function publishTeacherDailyStudentUpdate(
  value: unknown,
  context: RequestContext,
  deps: DailyStudentUpdateDependencies = {},
) {
  return transition(value, context, "PUBLISHED", deps);
}

export function archiveTeacherDailyStudentUpdate(
  value: unknown,
  context: RequestContext,
  deps: DailyStudentUpdateDependencies = {},
) {
  return transition(value, context, "ARCHIVED", deps);
}
