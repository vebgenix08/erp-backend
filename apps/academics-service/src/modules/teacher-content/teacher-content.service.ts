import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@school-erp/errors";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import type { WorkloadAssignmentView } from "../teacher-workload/teacher-workload.model";
import {
  teacherContentRepository,
  type TeacherContentRepository,
} from "./teacher-content.repository";
import type {
  LessonPlanRecord,
  TeachingDiaryRecord,
  TeachingResourceRecord,
} from "./teacher-content.model";
import {
  validateLessonPlanPageInput,
  validateSaveLessonPlanInput,
  validateSaveTeachingDiaryInput,
  validateSaveTeachingResourceInput,
  validateTeacherContentTransitionInput,
  validateTeachingDiaryPageInput,
  validateTeachingResourcePageInput,
} from "./teacher-content.validator";

export interface TeacherContentDependencies extends TeacherWorkloadDependencies {
  repository?: TeacherContentRepository;
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
const timestamp = (deps: TeacherContentDependencies) =>
  (deps.now ?? (() => new Date()))().toISOString();
const repository = (deps: TeacherContentDependencies) =>
  deps.repository ?? teacherContentRepository();

async function workspace(
  academicYearId: string | undefined,
  context: RequestContext,
  deps: TeacherContentDependencies,
) {
  return (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    { ...(academicYearId ? { academicYearId } : {}), viewMode: "PUBLISHED" },
    context,
    deps,
  );
}

async function assignmentFor(
  subjectOfferingId: string,
  academicYearId: string,
  context: RequestContext,
  deps: TeacherContentDependencies,
) {
  const result = await workspace(academicYearId, context, deps);
  const assignment = result.assignments.find(
    (item) => item.subjectOfferingId === subjectOfferingId,
  );
  if (!assignment) throw new NotFoundError("assigned subject offering was not found");
  return { workspace: result, assignment };
}

function scope(assignment: WorkloadAssignmentView) {
  return {
    campusId: assignment.campusId,
    subjectOfferingId: assignment.subjectOfferingId,
    ...(assignment.sectionId ? { sectionId: assignment.sectionId } : {}),
    ...(assignment.subjectBatchId ? { subjectBatchId: assignment.subjectBatchId } : {}),
    subjectName: assignment.subjectName,
    ...(assignment.className ? { className: assignment.className } : {}),
    ...(assignment.sectionName ? { sectionName: assignment.sectionName } : {}),
  };
}

async function listInput(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies,
  validate: typeof validateLessonPlanPageInput,
) {
  const input = validate(value);
  const result = await workspace(input.academicYearId, context, deps);
  if (
    input.subjectOfferingId &&
    !result.assignments.some((item) => item.subjectOfferingId === input.subjectOfferingId)
  )
    throw new NotFoundError("assigned subject offering was not found");
  return { input, result };
}

export async function listTeacherLessonPlans(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const { input, result } = await listInput(value, context, deps, validateLessonPlanPageInput);
  return repository(deps).listLessonPlans(tenant(context), {
    employeeId: result.teacher.id,
    academicYearId: result.academicYear.id,
    ...input,
  });
}

export async function listTeacherDiaryEntries(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = validateTeachingDiaryPageInput(value);
  const result = await workspace(input.academicYearId, context, deps);
  if (
    input.subjectOfferingId &&
    !result.assignments.some((item) => item.subjectOfferingId === input.subjectOfferingId)
  )
    throw new NotFoundError("assigned subject offering was not found");
  return repository(deps).listDiaryEntries(tenant(context), {
    employeeId: result.teacher.id,
    academicYearId: result.academicYear.id,
    ...input,
  });
}

export async function listTeacherResources(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = validateTeachingResourcePageInput(value);
  const result = await workspace(input.academicYearId, context, deps);
  if (
    input.subjectOfferingId &&
    !result.assignments.some((item) => item.subjectOfferingId === input.subjectOfferingId)
  )
    throw new NotFoundError("assigned subject offering was not found");
  return repository(deps).listResources(tenant(context), {
    employeeId: result.teacher.id,
    academicYearId: result.academicYear.id,
    ...input,
  });
}

export async function saveTeacherLessonPlan(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = validateSaveLessonPlanInput(value);
  const { workspace: result, assignment } = await assignmentFor(
    input.subjectOfferingId,
    input.academicYearId,
    context,
    deps,
  );
  const store = repository(deps);
  const tenantId = tenant(context);
  const existing = input.id ? await store.getLessonPlan(tenantId, input.id) : null;
  if (input.id && !existing) throw new NotFoundError("lesson plan was not found");
  if (existing && existing.employeeId !== result.teacher.id)
    throw new NotFoundError("lesson plan was not found");
  if (existing && existing.status !== "DRAFT")
    throw new ConflictError("only a draft lesson plan can be edited");
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version)
    throw new ConflictError("lesson plan version is stale");
  const now = timestamp(deps);
  const userId = actor(context);
  return store.saveLessonPlan(
    {
      id: existing?.id ?? `lesson_plan_${crypto.randomUUID()}`,
      tenantId,
      employeeId: result.teacher.id,
      academicYearId: result.academicYear.id,
      ...scope(assignment),
      planDate: input.planDate,
      title: input.title,
      learningObjectives: input.learningObjectives,
      topics: input.topics,
      ...(input.learningActivities ? { learningActivities: input.learningActivities } : {}),
      ...(input.preparationNotes ? { preparationNotes: input.preparationNotes } : {}),
      ...(input.homework ? { homework: input.homework } : {}),
      resourceIds: input.resourceIds,
      status: "DRAFT",
      version: (existing?.version ?? 0) + 1,
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? now,
      updatedBy: userId,
      updatedAt: now,
    },
    existing?.version,
  );
}

export async function saveTeacherDiaryEntry(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = validateSaveTeachingDiaryInput(value);
  const { workspace: result, assignment } = await assignmentFor(
    input.subjectOfferingId,
    input.academicYearId,
    context,
    deps,
  );
  const store = repository(deps);
  const tenantId = tenant(context);
  const existing = input.id ? await store.getDiaryEntry(tenantId, input.id) : null;
  if (input.id && !existing) throw new NotFoundError("teaching diary entry was not found");
  if (existing && existing.employeeId !== result.teacher.id)
    throw new NotFoundError("teaching diary entry was not found");
  if (existing && existing.status !== "DRAFT")
    throw new ConflictError("only a draft teaching diary entry can be edited");
  if (input.lessonPlanId) {
    const plan = await store.getLessonPlan(tenantId, input.lessonPlanId);
    if (
      !plan ||
      plan.employeeId !== result.teacher.id ||
      plan.subjectOfferingId !== assignment.subjectOfferingId
    )
      throw new NotFoundError("linked lesson plan was not found in this assignment");
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version)
    throw new ConflictError("teaching diary version is stale");
  const now = timestamp(deps);
  const userId = actor(context);
  return store.saveDiaryEntry(
    {
      id: existing?.id ?? `teaching_diary_${crypto.randomUUID()}`,
      tenantId,
      employeeId: result.teacher.id,
      academicYearId: result.academicYear.id,
      ...scope(assignment),
      entryDate: input.entryDate,
      topic: input.topic,
      summary: input.summary,
      ...(input.homework ? { homework: input.homework } : {}),
      ...(input.followUp ? { followUp: input.followUp } : {}),
      ...(input.lessonPlanId ? { lessonPlanId: input.lessonPlanId } : {}),
      status: "DRAFT",
      version: (existing?.version ?? 0) + 1,
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? now,
      updatedBy: userId,
      updatedAt: now,
    },
    existing?.version,
  );
}

export async function saveTeacherResource(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = validateSaveTeachingResourceInput(value);
  const { workspace: result, assignment } = await assignmentFor(
    input.subjectOfferingId,
    input.academicYearId,
    context,
    deps,
  );
  const store = repository(deps);
  const tenantId = tenant(context);
  const existing = input.id ? await store.getResource(tenantId, input.id) : null;
  if (input.id && !existing) throw new NotFoundError("teaching resource was not found");
  if (existing && existing.employeeId !== result.teacher.id)
    throw new NotFoundError("teaching resource was not found");
  if (existing?.status === "ARCHIVED")
    throw new ConflictError("an archived teaching resource cannot be edited");
  if (input.expectedVersion !== undefined && input.expectedVersion !== existing?.version)
    throw new ConflictError("teaching resource version is stale");
  const now = timestamp(deps);
  const userId = actor(context);
  return store.saveResource(
    {
      id: existing?.id ?? `teaching_resource_${crypto.randomUUID()}`,
      tenantId,
      employeeId: result.teacher.id,
      academicYearId: result.academicYear.id,
      ...scope(assignment),
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      resourceType: input.resourceType,
      ...(input.fileId ? { fileId: input.fileId } : {}),
      ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
      ...(input.fileName ? { fileName: input.fileName } : {}),
      ...(input.contentType ? { contentType: input.contentType } : {}),
      status: "ACTIVE",
      version: (existing?.version ?? 0) + 1,
      createdBy: existing?.createdBy ?? userId,
      createdAt: existing?.createdAt ?? now,
      updatedBy: userId,
      updatedAt: now,
    },
    existing?.version,
  );
}

async function transition<
  T extends LessonPlanRecord | TeachingDiaryRecord | TeachingResourceRecord,
>(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies,
  get: (tenantId: string, id: string) => Promise<T | null>,
  save: (record: T, version: number) => Promise<T>,
  allowed: readonly string[],
  target: T["status"],
  dateField: string,
) {
  const input = validateTeacherContentTransitionInput(value);
  const tenantId = tenant(context);
  const current = await get(tenantId, input.id);
  if (!current) throw new NotFoundError("teacher content record was not found");
  const result = await workspace(current.academicYearId, context, deps);
  if (current.employeeId !== result.teacher.id)
    throw new NotFoundError("teacher content record was not found");
  if (current.version !== input.expectedVersion)
    throw new ConflictError("teacher content version is stale");
  if (!allowed.includes(current.status))
    throw new ConflictError(`record cannot move from ${current.status} to ${String(target)}`);
  const now = timestamp(deps);
  return save(
    {
      ...current,
      status: target,
      version: current.version + 1,
      updatedBy: actor(context),
      updatedAt: now,
      [dateField]: now,
    } as T,
    current.version,
  );
}

export function setTeacherLessonPlanStatus(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = value as { status?: string };
  const target = input?.status;
  if (!(["READY", "COMPLETED", "ARCHIVED"] as const).includes(target as never))
    throw new ValidationError([
      { field: "status", message: "status must be READY, COMPLETED or ARCHIVED" },
    ]);
  const allowed =
    target === "READY"
      ? ["DRAFT"]
      : target === "COMPLETED"
        ? ["READY"]
        : ["DRAFT", "READY", "COMPLETED"];
  const dateField =
    target === "READY" ? "readyAt" : target === "COMPLETED" ? "completedAt" : "archivedAt";
  const store = repository(deps);
  return transition(
    value,
    context,
    deps,
    store.getLessonPlan.bind(store),
    store.saveLessonPlan.bind(store),
    allowed,
    target as LessonPlanRecord["status"],
    dateField,
  );
}

export function setTeacherDiaryStatus(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const input = value as { status?: string };
  const target = input?.status;
  if (!(["RECORDED", "ARCHIVED"] as const).includes(target as never))
    throw new ValidationError([
      { field: "status", message: "status must be RECORDED or ARCHIVED" },
    ]);
  const allowed = target === "RECORDED" ? ["DRAFT"] : ["DRAFT", "RECORDED"];
  const store = repository(deps);
  return transition(
    value,
    context,
    deps,
    store.getDiaryEntry.bind(store),
    store.saveDiaryEntry.bind(store),
    allowed,
    target as TeachingDiaryRecord["status"],
    target === "RECORDED" ? "recordedAt" : "archivedAt",
  );
}

export function archiveTeacherResource(
  value: unknown,
  context: RequestContext,
  deps: TeacherContentDependencies = {},
) {
  const store = repository(deps);
  return transition(
    value,
    context,
    deps,
    store.getResource.bind(store),
    store.saveResource.bind(store),
    ["ACTIVE"],
    "ARCHIVED" as TeachingResourceRecord["status"],
    "archivedAt",
  );
}
