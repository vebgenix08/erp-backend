import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@school-erp/errors";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type { WorkloadAssignmentView } from "../teacher-workload/teacher-workload.model";
import {
  teacherEngagementRepository,
  type TeacherEngagementRepository,
} from "./teacher-engagement.repository";
import type {
  AcademicDoubtStatus,
  CourseworkRecord,
  CourseworkStatus,
  CourseworkSubmissionStatus,
} from "./teacher-engagement.model";
import {
  validateEngagementPageInput,
  validateReplyDoubtInput,
  validateReviewSubmissionInput,
  validateSaveCourseworkInput,
  validateTransitionInput,
} from "./teacher-engagement.validator";

export interface TeacherEngagementDependencies extends TeacherWorkloadDependencies {
  repository?: TeacherEngagementRepository;
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
  if (!value)
    throw new ValidationError([{ field: "auth", message: "authenticated user is required" }]);
  return value;
};
const store = (deps: TeacherEngagementDependencies) =>
  deps.repository ?? teacherEngagementRepository();
const now = (deps: TeacherEngagementDependencies) =>
  (deps.now ?? (() => new Date()))().toISOString();
async function workspace(
  yearId: string | undefined,
  context: RequestContext,
  deps: TeacherEngagementDependencies,
) {
  return (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    { ...(yearId ? { academicYearId: yearId } : {}), viewMode: "PUBLISHED" },
    context,
    deps,
  );
}
async function assignment(
  offeringId: string,
  yearId: string,
  context: RequestContext,
  deps: TeacherEngagementDependencies,
) {
  const result = await workspace(yearId, context, deps);
  const item = result.assignments.find((entry) => entry.subjectOfferingId === offeringId);
  if (!item) throw new NotFoundError("assigned subject offering was not found");
  return { result, item };
}
const scope = (item: WorkloadAssignmentView) => ({
  campusId: item.campusId,
  subjectOfferingId: item.subjectOfferingId,
  ...(item.sectionId ? { sectionId: item.sectionId } : {}),
  ...(item.subjectBatchId ? { subjectBatchId: item.subjectBatchId } : {}),
  subjectName: item.subjectName,
  ...(item.className ? { className: item.className } : {}),
  ...(item.sectionName ? { sectionName: item.sectionName } : {}),
});
async function listContext(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies,
  statuses: readonly string[],
) {
  const input = validateEngagementPageInput(value, statuses);
  const result = await workspace(input.academicYearId, context, deps);
  if (
    input.subjectOfferingId &&
    !result.assignments.some((item) => item.subjectOfferingId === input.subjectOfferingId)
  )
    throw new NotFoundError("assigned subject offering was not found");
  return { input, result };
}

export async function listTeacherCoursework(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const { input, result } = await listContext(value, context, deps, [
    "DRAFT",
    "PUBLISHED",
    "CLOSED",
    "ARCHIVED",
  ]);
  const { status, ...rest } = input;
  return store(deps).listCoursework(tenant(context), {
    teacherEmployeeId: result.teacher.id,
    academicYearId: result.academicYear.id,
    ...rest,
    ...(status ? { status: status as CourseworkStatus } : {}),
  });
}
export async function listTeacherCourseworkSubmissions(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const { input, result } = await listContext(value, context, deps, [
    "SUBMITTED",
    "REVIEWED",
    "RETURNED",
  ]);
  const { status, ...rest } = input;
  return store(deps).listSubmissions(tenant(context), {
    teacherEmployeeId: result.teacher.id,
    academicYearId: result.academicYear.id,
    ...rest,
    ...(status ? { status: status as CourseworkSubmissionStatus } : {}),
  });
}
export async function listTeacherAcademicDoubts(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const { input, result } = await listContext(value, context, deps, ["OPEN", "ANSWERED", "CLOSED"]);
  const { status, ...rest } = input;
  return store(deps).listDoubts(tenant(context), {
    teacherEmployeeId: result.teacher.id,
    academicYearId: result.academicYear.id,
    ...rest,
    ...(status ? { status: status as AcademicDoubtStatus } : {}),
  });
}

export async function saveTeacherCoursework(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const input = validateSaveCourseworkInput(value);
  const { result, item } = await assignment(
    input.subjectOfferingId,
    input.academicYearId,
    context,
    deps,
  );
  const repository = store(deps);
  const tenantId = tenant(context);
  const existing = input.id ? await repository.getCoursework(tenantId, input.id) : null;
  if (input.id && !existing) throw new NotFoundError("coursework was not found");
  if (existing && existing.employeeId !== result.teacher.id)
    throw new NotFoundError("coursework was not found");
  if (existing && existing.status !== "DRAFT")
    throw new ConflictError("only draft coursework can be edited");
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version)
    throw new ConflictError("coursework version is stale");
  const timestamp = now(deps);
  const userId = actor(context);
  return repository.saveCoursework(
    {
      id: existing?.id ?? `coursework_${crypto.randomUUID()}`,
      tenantId,
      employeeId: result.teacher.id,
      academicYearId: result.academicYear.id,
      ...scope(item),
      title: input.title,
      instructions: input.instructions,
      assignedDate: input.assignedDate,
      ...(input.submissionDate ? { submissionDate: input.submissionDate } : {}),
      resourceIds: input.resourceIds,
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

export async function setTeacherCourseworkStatus(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const input = validateTransitionInput(value);
  const target = input.status;
  if (!(target === "PUBLISHED" || target === "CLOSED" || target === "ARCHIVED"))
    throw new ValidationError([
      { field: "status", message: "status must be PUBLISHED, CLOSED or ARCHIVED" },
    ]);
  const repository = store(deps);
  const tenantId = tenant(context);
  const current = await repository.getCoursework(tenantId, input.id);
  if (!current) throw new NotFoundError("coursework was not found");
  const result = await workspace(current.academicYearId, context, deps);
  if (current.employeeId !== result.teacher.id) throw new NotFoundError("coursework was not found");
  if (current.version !== input.expectedVersion)
    throw new ConflictError("coursework version is stale");
  const allowed =
    target === "PUBLISHED"
      ? current.status === "DRAFT"
      : target === "CLOSED"
        ? current.status === "PUBLISHED"
        : current.status !== "ARCHIVED";
  if (!allowed)
    throw new ConflictError(`coursework cannot move from ${current.status} to ${target}`);
  const timestamp = now(deps);
  const field =
    target === "PUBLISHED" ? "publishedAt" : target === "CLOSED" ? "closedAt" : "archivedAt";
  return repository.saveCoursework(
    {
      ...current,
      status: target,
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: timestamp,
      [field]: timestamp,
    } as CourseworkRecord,
    current.version,
  );
}

export async function reviewTeacherCourseworkSubmission(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const input = validateReviewSubmissionInput(value);
  const repository = store(deps);
  const tenantId = tenant(context);
  const current = await repository.getSubmission(tenantId, input.id);
  if (!current) throw new NotFoundError("coursework submission was not found");
  const result = await workspace(current.academicYearId, context, deps);
  if (
    current.teacherEmployeeId !== result.teacher.id ||
    !result.assignments.some((item) => item.subjectOfferingId === current.subjectOfferingId)
  )
    throw new NotFoundError("coursework submission was not found");
  if (current.version !== input.expectedVersion)
    throw new ConflictError("submission version is stale");
  const timestamp = now(deps);
  return repository.saveSubmission(
    {
      ...current,
      status: input.status,
      ...(input.feedback ? { feedback: input.feedback } : {}),
      reviewedBy: actor(context),
      reviewedAt: timestamp,
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: timestamp,
    },
    current.version,
  );
}

export async function replyTeacherAcademicDoubt(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const input = validateReplyDoubtInput(value);
  const repository = store(deps);
  const tenantId = tenant(context);
  const current = await repository.getDoubt(tenantId, input.id);
  if (!current) throw new NotFoundError("academic doubt was not found");
  const result = await workspace(current.academicYearId, context, deps);
  if (
    current.teacherEmployeeId !== result.teacher.id ||
    !result.assignments.some((item) => item.subjectOfferingId === current.subjectOfferingId)
  )
    throw new NotFoundError("academic doubt was not found");
  if (current.version !== input.expectedVersion)
    throw new ConflictError("academic doubt version is stale");
  if (current.status === "CLOSED")
    throw new ConflictError("a closed academic doubt cannot receive replies");
  const timestamp = now(deps);
  return repository.saveDoubt(
    {
      ...current,
      replies: [
        ...current.replies,
        {
          id: `doubt_reply_${crypto.randomUUID()}`,
          authorType: "TEACHER",
          authorId: actor(context),
          message: input.message,
          fileIds: input.fileIds,
          createdAt: timestamp,
        },
      ],
      status: "ANSWERED",
      answeredAt: timestamp,
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: timestamp,
    },
    current.version,
  );
}

export async function closeTeacherAcademicDoubt(
  value: unknown,
  context: RequestContext,
  deps: TeacherEngagementDependencies = {},
) {
  const input = validateTransitionInput(value);
  const repository = store(deps);
  const tenantId = tenant(context);
  const current = await repository.getDoubt(tenantId, input.id);
  if (!current) throw new NotFoundError("academic doubt was not found");
  const result = await workspace(current.academicYearId, context, deps);
  if (current.teacherEmployeeId !== result.teacher.id)
    throw new NotFoundError("academic doubt was not found");
  if (current.version !== input.expectedVersion)
    throw new ConflictError("academic doubt version is stale");
  if (current.status === "CLOSED") throw new ConflictError("academic doubt is already closed");
  const timestamp = now(deps);
  return repository.saveDoubt(
    {
      ...current,
      status: "CLOSED",
      closedAt: timestamp,
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: timestamp,
    },
    current.version,
  );
}
