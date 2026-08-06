import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@school-erp/errors";
import { planningStore, type PlanningCollection, type PlanningDocument, type PlanningStore } from "../planning-store/planning-store.repository";
import { subjectCatalogueRepository } from "../subject-catalogue/subject-catalogue.repository";

export interface LearningDeliveryDeps { store?: PlanningStore }
const tenant = (ctx: RequestContext) => { const value = ctx.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (ctx: RequestContext) => { const value = ctx.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (ctx: RequestContext, resource: string, action: string) => { const permission = `academics.${resource}.${action}` as Permission; if (!ctx.authContext?.user?.permissions.includes(permission)) throw new ForbiddenError(`permission ${permission} is required`); };
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (input: Record<string, unknown>, field: string) => { const value = input[field]; if (typeof value !== "string" || !value.trim()) throw new ValidationError([{ field, message: `${field} is required` }]); return value.trim(); };
const optionalText = (input: Record<string, unknown>, field: string) => typeof input[field] === "string" && input[field].trim() ? input[field].trim() : undefined;
const date = (input: Record<string, unknown>, field: string) => { const value = new Date(text(input, field)); if (Number.isNaN(value.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]); return value; };
const optionalDate = (input: Record<string, unknown>, field: string) => { const value = optionalText(input, field); if (!value) return undefined; const result = new Date(value); if (Number.isNaN(result.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]); return result; };
const strings = (input: Record<string, unknown>, field: string, minimum = 0) => { const value = input[field]; if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()) || value.length < minimum) throw new ValidationError([{ field, message: `${field} requires at least ${minimum} values` }]); return [...new Set(value.map((item) => String(item).trim()))]; };
const positive = (input: Record<string, unknown>, field: string, defaultValue?: number) => { if (input[field] === undefined && defaultValue !== undefined) return defaultValue; const value = Number(input[field]); if (!Number.isFinite(value) || value < 1) throw new ValidationError([{ field, message: `${field} must be positive` }]); return value; };
const view = (document: PlanningDocument) => { const { _id: _ignored, ...record } = document; return record; };
const create = async (store: PlanningStore, collection: PlanningCollection, tenantId: string, actorId: string, prefix: string, input: Record<string, unknown>) => {
  const now = new Date(), id = `${prefix}_${crypto.randomUUID()}`;
  return view(await store.insert(collection, tenantId, { _id: id, id, tenantId, ...input, createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 }));
};
const dependency = (deps?: LearningDeliveryDeps) => deps?.store ?? planningStore();
const requireRecord = async (store: PlanningStore, collection: PlanningCollection, tenantId: string, id: string, message: string) => { const record = await store.get(collection, tenantId, id); if (!record) throw new NotFoundError(message); return record; };

export async function listDeliveryRecords(collection: PlanningCollection, resource: string, filter: Record<string, unknown>, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, resource, "read"); return (await dependency(deps).list(collection, tenant(ctx), filter)).map(view);
}
export async function listSubjectOfferingRecords(filter: Record<string, unknown>, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "subject-offering", "read");
  const tenantId = tenant(ctx), store = dependency(deps);
  const [offerings, curriculumSubjects, catalogue] = await Promise.all([
    store.list("subject_offerings", tenantId, filter),
    store.list("curriculum_subjects", tenantId),
    subjectCatalogueRepository.list(tenantId, {}),
  ]);
  const catalogueIdByCurriculumSubject = new Map(
    curriculumSubjects.map((item) => [item.id, String(item.subjectCatalogueId ?? "")]),
  );
  const subjectNameByCatalogueId = new Map(catalogue.map((item) => [item.id, item.name]));
  return offerings.map((item) => ({
    ...view(item),
    subjectName:
      subjectNameByCatalogueId.get(catalogueIdByCurriculumSubject.get(String(item.curriculumSubjectId)) ?? "") ??
      "Subject",
  }));
}
export async function createSectionSubjectException(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "section-subject-exception", "manage"); const input = object(value), store = dependency(deps), tenantId = tenant(ctx), subjectPlanId = text(input, "subjectPlanId");
  await requireRecord(store, "academic_year_subject_plans" as PlanningCollection, tenantId, subjectPlanId, "subject plan was not found");
  const action = text(input, "action"); if (!["ADD", "EXCLUDE", "OVERRIDE_PERIODS", "REPLACE_WITH_TEACHING_GROUP"].includes(action)) throw new ValidationError([{ field: "action", message: "invalid section exception action" }]);
  return create(store, "section_subject_exceptions", tenantId, actor(ctx), "section_subject_exception", { academicYearId: text(input, "academicYearId"), subjectPlanId, sectionId: text(input, "sectionId"), action, reason: text(input, "reason"), effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE" });
}
export async function createSubjectChoiceGroup(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "subject-choice-group", "manage"); const input = object(value), options = strings(input, "optionCurriculumSubjectIds", 2), minimumSelections = positive(input, "minimumSelections", 1), maximumSelections = positive(input, "maximumSelections", 1);
  if (minimumSelections > maximumSelections || maximumSelections > options.length) throw new ValidationError([{ field: "maximumSelections", message: "selection limits do not match available options" }]);
  const store = dependency(deps), tenantId = tenant(ctx); for (const id of options) await requireRecord(store, "curriculum_subjects" as PlanningCollection, tenantId, id, "curriculum subject option was not found");
  return create(store, "subject_choice_groups", tenantId, actor(ctx), "subject_choice_group", { campusId: text(input, "campusId"), academicYearId: text(input, "academicYearId"), academicUnitId: text(input, "academicUnitId"), curriculumId: text(input, "curriculumId"), programId: text(input, "programId"), academicLevelId: text(input, "academicLevelId"), name: text(input, "name"), code: text(input, "code").toUpperCase(), minimumSelections, maximumSelections, optionCurriculumSubjectIds: options, status: "ACTIVE" });
}
export async function selectStudentSubject(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "student-subject-choice", "manage"); const input = object(value), store = dependency(deps), tenantId = tenant(ctx), choiceGroupId = text(input, "choiceGroupId"), curriculumSubjectId = text(input, "curriculumSubjectId"), studentId = text(input, "studentId");
  const group = await requireRecord(store, "subject_choice_groups", tenantId, choiceGroupId, "subject choice group was not found");
  if (!Array.isArray(group.optionCurriculumSubjectIds) || !group.optionCurriculumSubjectIds.includes(curriculumSubjectId)) throw new ConflictError("subject is not configured in the choice group");
  if ((await store.list("student_subject_choices", tenantId, { studentId, choiceGroupId, status: "ACTIVE" })).length) throw new ConflictError("student already has an active choice in this group");
  return create(store, "student_subject_choices", tenantId, actor(ctx), "student_subject_choice", { academicYearId: text(input, "academicYearId"), studentId, enrollmentId: text(input, "enrollmentId"), choiceGroupId, curriculumSubjectId, effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE", selectedBy: actor(ctx) });
}
export async function createTeachingGroupRecord(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "teaching-group", "manage"); const input = object(value), type = text(input, "type"), homeSectionId = optionalText(input, "homeSectionId");
  if (!["SECTION", "COMBINED_SECTIONS", "LANGUAGE_GROUP", "ELECTIVE_GROUP", "PRACTICAL_BATCH", "TUTORIAL_BATCH", "PROJECT_GROUP"].includes(type)) throw new ValidationError([{ field: "type", message: "invalid teaching group type" }]);
  if (type === "SECTION" && !homeSectionId) throw new ValidationError([{ field: "homeSectionId", message: "SECTION group requires homeSectionId" }]);
  const store = dependency(deps), tenantId = tenant(ctx), academicYearId = text(input, "academicYearId");
  if (type === "SECTION") { const existing = (await store.list("teaching_groups", tenantId, { academicYearId, homeSectionId, type: "SECTION", status: "ACTIVE" }))[0]; if (existing) return view(existing); }
  const sourceSectionIds = Array.isArray(input.sourceSectionIds) ? strings(input, "sourceSectionIds") : undefined;
  return create(store, "teaching_groups", tenantId, actor(ctx), "teaching_group", { campusId: text(input, "campusId"), academicYearId, academicUnitId: text(input, "academicUnitId"), curriculumId: text(input, "curriculumId"), programId: text(input, "programId"), academicLevelId: text(input, "academicLevelId"), type, name: text(input, "name"), code: text(input, "code").toUpperCase(), ...(homeSectionId ? { homeSectionId } : {}), ...(sourceSectionIds ? { sourceSectionIds } : {}), ...(input.capacity !== undefined ? { capacity: positive(input, "capacity") } : {}), ...(input.maximumGroupSize !== undefined ? { maximumGroupSize: positive(input, "maximumGroupSize") } : {}), effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE" });
}
export async function addTeachingGroupMembership(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "teaching-group", "manage"); const input = object(value), store = dependency(deps), tenantId = tenant(ctx), teachingGroupId = text(input, "teachingGroupId"), studentId = text(input, "studentId");
  await requireRecord(store, "teaching_groups", tenantId, teachingGroupId, "teaching group was not found");
  if ((await store.list("teaching_group_memberships", tenantId, { teachingGroupId, studentId, status: "ACTIVE" })).length) throw new ConflictError("student already belongs to this teaching group");
  return create(store, "teaching_group_memberships", tenantId, actor(ctx), "teaching_group_membership", { teachingGroupId, studentId, enrollmentId: text(input, "enrollmentId"), membershipSource: text(input, "membershipSource"), effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE", ...(optionalText(input, "reason") ? { reason: optionalText(input, "reason") } : {}) });
}
export async function createSubjectBatch(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "subject-batch", "manage");
  const input = object(value), store = dependency(deps), tenantId = tenant(ctx), batchType = text(input, "batchType");
  if (!["LANGUAGE", "ELECTIVE", "PRACTICAL", "TUTORIAL", "COMBINED_SECTION", "PROJECT"].includes(batchType)) {
    throw new ValidationError([{ field: "batchType", message: "invalid subject batch type" }]);
  }
  const curriculumSubjectId = text(input, "curriculumSubjectId"), sourceSectionIds = strings(input, "sourceSectionIds", 1);
  await requireRecord(store, "curriculum_subjects", tenantId, curriculumSubjectId, "curriculum subject was not found");
  for (const sectionId of sourceSectionIds) await requireRecord(store, "academics_sections", tenantId, sectionId, "source section was not found");
  const subjectComponentId = optionalText(input, "subjectComponentId");
  if (subjectComponentId) await requireRecord(store, "subject_components", tenantId, subjectComponentId, "subject component was not found");
  return create(store, "subject_batches", tenantId, actor(ctx), "subject_batch", {
    campusId: text(input, "campusId"), academicYearId: text(input, "academicYearId"), academicUnitId: text(input, "academicUnitId"),
    curriculumId: text(input, "curriculumId"), programId: text(input, "programId"), academicLevelId: text(input, "academicLevelId"),
    curriculumSubjectId, ...(subjectComponentId ? { subjectComponentId } : {}), name: text(input, "name"), code: text(input, "code").toUpperCase(),
    batchType, sourceSectionIds, ...(input.capacity !== undefined ? { capacity: positive(input, "capacity") } : {}),
    ...(input.maximumStrength !== undefined ? { maximumStrength: positive(input, "maximumStrength") } : {}),
    effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE",
  });
}
export async function addSubjectBatchMembership(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "subject-batch", "manage");
  const input = object(value), store = dependency(deps), tenantId = tenant(ctx), subjectBatchId = text(input, "subjectBatchId"), studentId = text(input, "studentId");
  await requireRecord(store, "subject_batches", tenantId, subjectBatchId, "subject batch was not found");
  if ((await store.list("subject_batch_memberships", tenantId, { subjectBatchId, studentId, status: "ACTIVE" })).length) throw new ConflictError("student already belongs to this subject batch");
  return create(store, "subject_batch_memberships", tenantId, actor(ctx), "subject_batch_membership", {
    subjectBatchId, studentId, enrollmentId: text(input, "enrollmentId"), membershipSource: text(input, "membershipSource"),
    effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}),
    status: "ACTIVE", ...(optionalText(input, "reason") ? { reason: optionalText(input, "reason") } : {}),
  });
}
export async function createSubjectOfferingRecord(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "subject-offering", "manage"); const input = object(value), store = dependency(deps), tenantId = tenant(ctx), subjectPlanId = text(input, "subjectPlanId"), subjectComponentId = text(input, "subjectComponentId"), targetType = text(input, "targetType"), sectionId = optionalText(input, "sectionId"), subjectBatchId = optionalText(input, "subjectBatchId");
  if (targetType === "SECTION" ? !sectionId || Boolean(subjectBatchId) : targetType === "SUBJECT_BATCH" ? !subjectBatchId || Boolean(sectionId) : true) throw new ValidationError([{ field: "targetType", message: "offering must target exactly one section or subject batch" }]);
  await requireRecord(store, "academic_year_subject_plans" as PlanningCollection, tenantId, subjectPlanId, "subject plan was not found"); await requireRecord(store, "subject_components" as PlanningCollection, tenantId, subjectComponentId, "subject component was not found");
  if (sectionId) await requireRecord(store, "academics_sections", tenantId, sectionId, "section was not found");
  if (subjectBatchId) await requireRecord(store, "subject_batches", tenantId, subjectBatchId, "subject batch was not found");
  const requiredConsecutiveSlots = positive(input, "requiredConsecutiveSlots", input.requiresConsecutivePeriods === true ? 2 : 1);
  return create(store, "subject_offerings", tenantId, actor(ctx), "subject_offering", { campusId: text(input, "campusId"), academicYearId: text(input, "academicYearId"), subjectPlanId, curriculumSubjectId: text(input, "curriculumSubjectId"), subjectComponentId, targetType, ...(sectionId ? { sectionId } : {}), ...(subjectBatchId ? { subjectBatchId } : {}), requiredPeriodsPerWeek: positive(input, "requiredPeriodsPerWeek"), requiredConsecutiveSlots, preferredSessionLength: positive(input, "preferredSessionLength", requiredConsecutiveSlots), requiresConsecutivePeriods: requiredConsecutiveSlots > 1, ...(input.maximumPeriodsPerDay !== undefined ? { maximumPeriodsPerDay: positive(input, "maximumPeriodsPerDay") } : {}), ...(optionalText(input, "preferredRoomTypeId") ? { preferredRoomTypeId: optionalText(input, "preferredRoomTypeId") } : {}), effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), readinessStatus: "INCOMPLETE", status: "ACTIVE" });
}
export async function createParallelBlockRecord(value: unknown, ctx: RequestContext, deps?: LearningDeliveryDeps) {
  permit(ctx, "timetable", "manage"); const input = object(value), offeringIds = strings(input, "requiredOfferingIds", 2), store = dependency(deps), tenantId = tenant(ctx);
  for (const id of offeringIds) await requireRecord(store, "subject_offerings", tenantId, id, "parallel block offering was not found");
  return create(store, "parallel_timetable_blocks", tenantId, actor(ctx), "parallel_timetable_block", { campusId: text(input, "campusId"), academicYearId: text(input, "academicYearId"), academicUnitId: text(input, "academicUnitId"), programId: text(input, "programId"), academicLevelId: text(input, "academicLevelId"), name: text(input, "name"), code: text(input, "code").toUpperCase(), type: text(input, "type"), sourceSectionIds: strings(input, "sourceSectionIds", 1), requiredOfferingIds: offeringIds, mustRunSimultaneously: input.mustRunSimultaneously !== false, status: "ACTIVE" });
}
