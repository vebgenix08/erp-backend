import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@school-erp/errors";
import { planningStore, type PlanningCollection, type PlanningDocument, type PlanningStore } from "../planning-store/planning-store.repository";
export interface TimetableDeps { store?: PlanningStore }
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const tenant = (ctx: RequestContext) => { const value = ctx.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (ctx: RequestContext) => { const value = ctx.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (ctx: RequestContext, action: string) => { const permission = `academics.timetable.${action}` as Permission; if (!ctx.authContext?.user?.permissions.includes(permission)) throw new ForbiddenError(`permission ${permission} is required`); };
const text = (input: Record<string, unknown>, field: string) => { const value = input[field]; if (typeof value !== "string" || !value.trim()) throw new ValidationError([{ field, message: `${field} is required` }]); return value.trim(); };
const optionalText = (input: Record<string, unknown>, field: string) => typeof input[field] === "string" && input[field].trim() ? input[field].trim() : undefined;
const strings = (input: Record<string, unknown>, field: string, minimum = 1) => { const value = input[field]; if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== "string" || !item.trim())) throw new ValidationError([{ field, message: `${field} requires at least ${minimum} values` }]); return [...new Set(value.map(String))]; };
const date = (input: Record<string, unknown>, field: string) => { const result = new Date(text(input, field)); if (Number.isNaN(result.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]); return result; };
const optionalDate = (input: Record<string, unknown>, field: string) => { const value = optionalText(input, field); if (!value) return undefined; const result = new Date(value); if (Number.isNaN(result.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]); return result; };
const positive = (input: Record<string, unknown>, field: string, allowZero = false) => { const value = Number(input[field]); if (!Number.isFinite(value) || value < (allowZero ? 0 : 1)) throw new ValidationError([{ field, message: `${field} is invalid` }]); return value; };
const minutes = (value: string) => { const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value); if (!match) throw new ValidationError([{ field: "time", message: "time must use HH:mm" }]); return Number(match[1]) * 60 + Number(match[2]); };
const repository = (deps?: TimetableDeps) => deps?.store ?? planningStore();
const view = (document: PlanningDocument) => { const { _id: _ignored, ...record } = document; return record; };
const timetableEntryRevision = (entries: PlanningDocument[]) =>
  entries
    .map((entry) => `${entry.id}:${entry.version}:${new Date(entry.updatedAt as Date | string).getTime()}`)
    .sort()
    .join("|");
const timetableOwnership = (version: PlanningDocument) => ({
  scopeType: version.scopeType,
  academicUnitId: version.academicUnitId,
  ...(version.programId ? { programId: version.programId } : {}),
  ...(version.academicLevelId ? { academicLevelId: version.academicLevelId } : {}),
  ...(version.sectionId ? { sectionId: version.sectionId } : {}),
});
const create = async (store: PlanningStore, collection: PlanningCollection, tenantId: string, actorId: string, prefix: string, input: Record<string, unknown>) => { const now = new Date(), id = `${prefix}_${crypto.randomUUID()}`; return view(await store.insert(collection, tenantId, { _id: id, id, tenantId, ...input, createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 })); };
const requireRecord = async (store: PlanningStore, collection: PlanningCollection, tenantId: string, id: string, message: string) => { const record = await store.get(collection, tenantId, id); if (!record) throw new NotFoundError(message); return record; };
const offeringsForVersion = async (store: PlanningStore, tenantId: string, version: PlanningDocument) => {
  const all = await store.list("subject_offerings", tenantId, { campusId: version.campusId, academicYearId: version.academicYearId, status: "ACTIVE" });
  if (version.scopeType === "SECTION" && typeof version.sectionId === "string") return all.filter((offering) => offering.sectionId === version.sectionId);
  if (version.scopeType === "ACADEMIC_LEVEL" && typeof version.academicLevelId === "string") {
    const [sections, batches] = await Promise.all([
      store.list("academics_sections", tenantId, { campusId: version.campusId, classId: version.academicLevelId, status: "ACTIVE" }),
      store.list("subject_batches", tenantId, { campusId: version.campusId, academicYearId: version.academicYearId, academicLevelId: version.academicLevelId, status: "ACTIVE" }),
    ]);
    const sectionIds = new Set(sections.map((item) => String(item.id))), batchIds = new Set(batches.map((item) => String(item.id)));
    return all.filter((offering) => sectionIds.has(String(offering.sectionId)) || batchIds.has(String(offering.subjectBatchId)));
  }
  return all;
};
export async function listTimetableRecords(collection: PlanningCollection, filter: Record<string, unknown>, ctx: RequestContext, deps?: TimetableDeps) { permit(ctx, "read"); return (await repository(deps).list(collection, tenant(ctx), filter)).map(view); }
export async function createRoomRecord(value: unknown, ctx: RequestContext, deps?: TimetableDeps) { permit(ctx, "manage"); const input = object(value), store = repository(deps), tenantId = tenant(ctx); return create(store, "rooms", tenantId, actor(ctx), "room", { campusId: text(input, "campusId"), ...(optionalText(input, "buildingId") ? { buildingId: optionalText(input, "buildingId") } : {}), code: text(input, "code").toUpperCase(), name: text(input, "name"), roomType: text(input, "roomType"), capacity: positive(input, "capacity"), ...(Array.isArray(input.features) ? { features: strings(input, "features", 0) } : {}), status: "ACTIVE" }); }
export async function createCampusTravelRule(value: unknown, ctx: RequestContext, deps?: TimetableDeps) { permit(ctx, "manage"); const input = object(value), sourceCampusId = text(input, "sourceCampusId"), targetCampusId = text(input, "targetCampusId"); if (sourceCampusId === targetCampusId) throw new ValidationError([{ field: "targetCampusId", message: "campuses must be different" }]); const store = repository(deps), tenantId = tenant(ctx); return create(store, "campus_travel_rules", tenantId, actor(ctx), "campus_travel_rule", { sourceCampusId, targetCampusId, minimumTravelMinutes: positive(input, "minimumTravelMinutes", true), status: "ACTIVE" }); }
export async function createPeriodSetRecord(value: unknown, ctx: RequestContext, deps?: TimetableDeps) { permit(ctx, "manage"); const input = object(value), store = repository(deps), tenantId = tenant(ctx); return create(store, "timetable_period_sets", tenantId, actor(ctx), "period_set", { campusId: text(input, "campusId"), academicYearId: text(input, "academicYearId"), academicUnitId: text(input, "academicUnitId"), name: text(input, "name"), ...(optionalText(input, "description") ? { description: optionalText(input, "description") } : {}), ...(optionalText(input, "instructionType") ? { instructionType: optionalText(input, "instructionType") } : {}), ...(Object.keys(object(input.preferences)).length ? { preferences: object(input.preferences) } : {}), applicableDays: strings(input, "applicableDays"), effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "DRAFT" }); }
export async function createPeriodSlotRecord(value: unknown, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage"); const input = object(value), store = repository(deps), tenantId = tenant(ctx), periodSetId = text(input, "periodSetId"), startTime = text(input, "startTime"), endTime = text(input, "endTime");
  await requireRecord(store, "timetable_period_sets", tenantId, periodSetId, "period set was not found"); if (minutes(startTime) >= minutes(endTime)) throw new ValidationError([{ field: "endTime", message: "endTime must be after startTime" }]);
  const overlap = (await store.list("timetable_period_slots", tenantId, { periodSetId, status: "ACTIVE" })).some((slot) => minutes(String(slot.startTime)) < minutes(endTime) && minutes(startTime) < minutes(String(slot.endTime))); if (overlap) throw new ConflictError("period slot overlaps an existing slot");
  return create(store, "timetable_period_slots", tenantId, actor(ctx), "period_slot", { periodSetId, sequence: positive(input, "sequence"), label: text(input, "label"), startTime, endTime, slotType: text(input, "slotType"), countsForTeachingWorkload: input.countsForTeachingWorkload === true, status: "ACTIVE" });
}
export async function createTimetableVersion(value: unknown, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage");
  const input = object(value), store = repository(deps), tenantId = tenant(ctx);
  const periodSetId = text(input, "periodSetId"), campusId = text(input, "campusId"), academicYearId = text(input, "academicYearId");
  const scopeType = text(input, "scopeType"), programId = optionalText(input, "programId"), academicLevelId = optionalText(input, "academicLevelId"), sectionId = optionalText(input, "sectionId");
  if (scopeType === "SECTION" && (!programId || !academicLevelId || !sectionId)) throw new ValidationError([{ field: "sectionId", message: "program, class and section are required for a section timetable" }]);
  if (scopeType === "ACADEMIC_LEVEL" && (!programId || !academicLevelId)) throw new ValidationError([{ field: "academicLevelId", message: "program and class are required for a class timetable" }]);
  await requireRecord(store, "timetable_period_sets", tenantId, periodSetId, "period set was not found");
  if (scopeType === "SECTION" || scopeType === "ACADEMIC_LEVEL") {
    const [academicClass, section] = await Promise.all([
      requireRecord(store, "academics_classes", tenantId, academicLevelId!, "class was not found"),
      sectionId ? requireRecord(store, "academics_sections", tenantId, sectionId, "section was not found") : Promise.resolve(undefined),
    ]);
    if (academicClass.campusId !== campusId || academicClass.programId !== programId) throw new ValidationError([{ field: "academicLevelId", message: "class does not belong to the selected campus and program" }]);
    if (section && (section.campusId !== campusId || section.programId !== programId || section.classId !== academicLevelId)) throw new ValidationError([{ field: "sectionId", message: "section does not belong to the selected class" }]);
  }
  const existing = await store.list("timetable_versions", tenantId, { campusId, academicYearId }), versionNumber = Math.max(0, ...existing.map((item) => Number(item.versionNumber ?? 0))) + 1;
  return create(store, "timetable_versions", tenantId, actor(ctx), "timetable_version", { campusId, academicYearId, academicUnitId: text(input, "academicUnitId"), name: text(input, "name"), versionNumber, scopeType, ...(programId ? { programId } : {}), ...(academicLevelId ? { academicLevelId } : {}), ...(sectionId ? { sectionId } : {}), periodSetId, status: "DRAFT", effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), generatedBy: text(input, "generatedBy") });
}
export async function createTimetableConstraint(value: unknown, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage"); const input = object(value), store = repository(deps), tenantId = tenant(ctx), constraintType = text(input, "constraintType"), parameters = object(input.parameters);
  const requiredParameters: Record<string, string[]> = { MAX_PERIODS_PER_DAY: ["maximum"], MAX_CONSECUTIVE_PERIODS: ["maximum"], MINIMUM_GAP: ["minutes"], REQUIRED_ROOM_TYPE: ["roomType"], CAMPUS_TRAVEL_TIME: ["minutes"] };
  for (const field of requiredParameters[constraintType] ?? []) if (parameters[field] === undefined) throw new ValidationError([{ field: `parameters.${field}`, message: `${field} is required for ${constraintType}` }]);
  const academicYearId = text(input, "academicYearId"), timetableVersionId = optionalText(input, "timetableVersionId"), scopeType = text(input, "scopeType"), scopeId = text(input, "scopeId"), actorId = actor(ctx);
  const record = { academicYearId, ...(timetableVersionId ? { timetableVersionId } : {}), scopeType, scopeId, constraintType, severity: text(input, "severity"), parameters, effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE" };
  const existing = (await store.list("timetable_constraints", tenantId, { academicYearId, ...(timetableVersionId ? { timetableVersionId } : {}), scopeType, scopeId, constraintType, status: "ACTIVE" }))[0];
  if (!existing) return create(store, "timetable_constraints", tenantId, actorId, "timetable_constraint", record);
  const updated = { ...existing, ...record, updatedAt: new Date(), updatedBy: actorId, version: Number(existing.version) + 1 };
  const replaced = await store.replace("timetable_constraints", tenantId, String(existing.id), Number(existing.version), updated);
  if (!replaced) throw new ConflictError("timetable constraint changed during update");
  return view(replaced);
}
export async function addTimetableEntry(value: unknown, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage"); const input = object(value), store = repository(deps), tenantId = tenant(ctx), timetableVersionId = text(input, "timetableVersionId"), subjectOfferingId = text(input, "subjectOfferingId"), periodSlotIds = strings(input, "periodSlotIds"), teachingAssignmentIds = strings(input, "teachingAssignmentIds");
  const version = await requireRecord(store, "timetable_versions", tenantId, timetableVersionId, "timetable version was not found"); if (version.status !== "DRAFT") throw new ConflictError("entries can only be changed in a draft timetable");
  const offering = await requireRecord(store, "subject_offerings", tenantId, subjectOfferingId, "subject offering was not found");
  const teachingGroupId = optionalText(input, "teachingGroupId") ?? (typeof offering.teachingGroupId === "string" ? offering.teachingGroupId : undefined);
  const sectionId = typeof offering.sectionId === "string" ? offering.sectionId : undefined, subjectBatchId = typeof offering.subjectBatchId === "string" ? offering.subjectBatchId : undefined;
  if (!sectionId && !subjectBatchId && !teachingGroupId) throw new ConflictError("subject offering has no schedulable target");
  if (teachingGroupId) await requireRecord(store, "teaching_groups", tenantId, teachingGroupId, "teaching group was not found");
  for (const id of periodSlotIds) await requireRecord(store, "timetable_period_slots", tenantId, id, "period slot was not found"); for (const id of teachingAssignmentIds) await requireRecord(store, "teaching_assignments_v2", tenantId, id, "teaching assignment was not found");
  const roomId = optionalText(input, "roomId"); if (roomId) await requireRecord(store, "rooms", tenantId, roomId, "room was not found");
  await assertTimetableEntryIsAvailable(store, tenantId, {
    timetableVersionId,
    dayOfWeek: text(input, "dayOfWeek"),
    periodSlotIds,
    ...(sectionId ? { sectionId } : {}),
    ...(subjectBatchId ? { subjectBatchId } : {}),
    ...(teachingGroupId ? { teachingGroupId } : {}),
    teachingAssignmentIds,
    ...(roomId ? { roomId } : {}),
  });
  return create(store, "timetable_entries", tenantId, actor(ctx), "timetable_entry", { timetableVersionId, dayOfWeek: text(input, "dayOfWeek"), periodSlotIds, subjectOfferingId, ...(sectionId ? { sectionId } : {}), ...(subjectBatchId ? { subjectBatchId } : {}), ...(teachingGroupId ? { teachingGroupId } : {}), teachingAssignmentIds, ...(roomId ? { roomId } : {}), ...(optionalText(input, "parallelBlockId") ? { parallelBlockId: optionalText(input, "parallelBlockId") } : {}), entryType: text(input, "entryType"), status: "ACTIVE" });
}

export async function updateTimetableEntry(id: string, value: unknown, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage");
  const input = object(value), store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx);
  const existing = await requireRecord(store, "timetable_entries", tenantId, id, "timetable entry was not found");
  const version = await requireRecord(store, "timetable_versions", tenantId, String(existing.timetableVersionId), "timetable version was not found");
  if (version.status !== "DRAFT") throw new ConflictError("only draft timetable entries can be edited");
  const subjectOfferingId = text(input, "subjectOfferingId"), offering = await requireRecord(store, "subject_offerings", tenantId, subjectOfferingId, "subject offering was not found");
  const periodSlotIds = strings(input, "periodSlotIds"), teachingAssignmentIds = strings(input, "teachingAssignmentIds");
  for (const slotId of periodSlotIds) await requireRecord(store, "timetable_period_slots", tenantId, slotId, "period slot was not found");
  for (const assignmentId of teachingAssignmentIds) await requireRecord(store, "teaching_assignments_v2", tenantId, assignmentId, "teaching assignment was not found");
  const sectionId = typeof offering.sectionId === "string" ? offering.sectionId : undefined;
  const subjectBatchId = typeof offering.subjectBatchId === "string" ? offering.subjectBatchId : undefined;
  const teachingGroupId = optionalText(input, "teachingGroupId") ?? (typeof offering.teachingGroupId === "string" ? offering.teachingGroupId : undefined);
  const roomId = optionalText(input, "roomId");
  if (roomId) await requireRecord(store, "rooms", tenantId, roomId, "room was not found");
  await assertTimetableEntryIsAvailable(store, tenantId, {
    timetableVersionId: String(existing.timetableVersionId),
    dayOfWeek: text(input, "dayOfWeek"),
    periodSlotIds,
    ...(sectionId ? { sectionId } : {}),
    ...(subjectBatchId ? { subjectBatchId } : {}),
    ...(teachingGroupId ? { teachingGroupId } : {}),
    teachingAssignmentIds,
    ...(roomId ? { roomId } : {}),
  }, id);
  const updated = {
    ...existing,
    dayOfWeek: text(input, "dayOfWeek"),
    periodSlotIds,
    subjectOfferingId,
    ...(sectionId ? { sectionId } : { sectionId: undefined }),
    ...(subjectBatchId ? { subjectBatchId } : { subjectBatchId: undefined }),
    ...(teachingGroupId ? { teachingGroupId } : { teachingGroupId: undefined }),
    teachingAssignmentIds,
    ...(roomId ? { roomId } : { roomId: undefined }),
    entryType: text(input, "entryType"),
    updatedAt: new Date(), updatedBy: actorId, version: Number(existing.version) + 1,
  };
  const replaced = await store.replace("timetable_entries", tenantId, id, Number(existing.version), updated);
  if (!replaced) throw new ConflictError("timetable entry changed during update");
  return view(replaced);
}

async function assertTimetableEntryIsAvailable(
  store: PlanningStore,
  tenantId: string,
  candidate: {
    timetableVersionId: string;
    dayOfWeek: string;
    periodSlotIds: string[];
    sectionId?: string;
    subjectBatchId?: string;
    teachingGroupId?: string;
    teachingAssignmentIds: string[];
    roomId?: string;
  },
  excludedEntryId?: string,
) {
  const slotIds = new Set(candidate.periodSlotIds);
  const assignmentIds = new Set(candidate.teachingAssignmentIds);
  const entries = await store.list("timetable_entries", tenantId, {
    timetableVersionId: candidate.timetableVersionId,
    dayOfWeek: candidate.dayOfWeek,
    status: "ACTIVE",
  });
  for (const entry of entries) {
    if (entry.id === excludedEntryId || !Array.isArray(entry.periodSlotIds) || !entry.periodSlotIds.some((slotId) => slotIds.has(String(slotId)))) continue;
    if (candidate.sectionId && entry.sectionId === candidate.sectionId) throw new ConflictError("section already has a lesson in the selected period");
    if (candidate.subjectBatchId && entry.subjectBatchId === candidate.subjectBatchId) throw new ConflictError("subject batch already has a lesson in the selected period");
    if (candidate.teachingGroupId && entry.teachingGroupId === candidate.teachingGroupId) throw new ConflictError("teaching group already has a lesson in the selected period");
    if (Array.isArray(entry.teachingAssignmentIds) && entry.teachingAssignmentIds.some((assignmentId) => assignmentIds.has(String(assignmentId)))) throw new ConflictError("teacher already has a lesson in the selected period");
    if (candidate.roomId && entry.roomId === candidate.roomId) throw new ConflictError("room already has a lesson in the selected period");
  }
}

export async function deactivateTimetableEntry(id: string, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage");
  const store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx);
  const existing = await requireRecord(store, "timetable_entries", tenantId, id, "timetable entry was not found");
  const timetable = await requireRecord(store, "timetable_versions", tenantId, String(existing.timetableVersionId), "timetable version was not found");
  if (timetable.status !== "DRAFT") throw new ConflictError("only draft timetable entries can be removed");
  const updated = { ...existing, status: "INACTIVE", updatedAt: new Date(), updatedBy: actorId, version: Number(existing.version) + 1 };
  const replaced = await store.replace("timetable_entries", tenantId, id, Number(existing.version), updated);
  if (!replaced) throw new ConflictError("timetable entry changed during removal");
  return view(replaced);
}

export async function createTimetableRevision(id: string, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage");
  const store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx);
  const source = await requireRecord(store, "timetable_versions", tenantId, id, "timetable version was not found");
  const ownership = timetableOwnership(source);
  const versions = await store.list("timetable_versions", tenantId, {
    campusId: source.campusId, academicYearId: source.academicYearId, ...ownership,
  });
  const sourceVersionNumber = Number(source.versionNumber ?? 0);
  const drafts = versions.filter((item) => item.id !== source.id && item.status === "DRAFT");
  if (drafts.some((item) => Number(item.versionNumber ?? 0) > sourceVersionNumber)) {
    throw new ConflictError("a newer editable draft already exists for this timetable");
  }
  for (const staleDraft of drafts) {
    const archived = {
      ...staleDraft,
      status: "ARCHIVED",
      archivedAt: new Date(),
      archivedBy: actorId,
      updatedAt: new Date(),
      updatedBy: actorId,
      version: Number(staleDraft.version) + 1,
    };
    const replaced = await store.replace("timetable_versions", tenantId, String(staleDraft.id), Number(staleDraft.version), archived);
    if (!replaced) throw new ConflictError("stale timetable draft changed during revision creation");
  }
  const versionNumber = Math.max(0, ...versions.map((item) => Number(item.versionNumber ?? 0))) + 1;
  const revision = await create(store, "timetable_versions", tenantId, actorId, "timetable_version", {
    campusId: source.campusId, academicYearId: source.academicYearId, academicUnitId: source.academicUnitId,
    name: `${String(source.name).replace(/ · Revision \d+$/, "")} · Revision ${versionNumber}`,
    versionNumber, scopeType: source.scopeType,
    ...(source.programId ? { programId: source.programId } : {}),
    ...(source.academicLevelId ? { academicLevelId: source.academicLevelId } : {}),
    ...(source.sectionId ? { sectionId: source.sectionId } : {}),
    periodSetId: source.periodSetId, status: "DRAFT", effectiveFrom: source.effectiveFrom,
    ...(source.effectiveUntil ? { effectiveUntil: source.effectiveUntil } : {}), generatedBy: "MANUAL_REVISION", sourceVersionId: source.id,
  });
  const sourceEntries = await store.list("timetable_entries", tenantId, { timetableVersionId: source.id, status: "ACTIVE" });
  for (const entry of sourceEntries) {
    await create(store, "timetable_entries", tenantId, actorId, "timetable_entry", {
      timetableVersionId: revision.id, dayOfWeek: entry.dayOfWeek, periodSlotIds: entry.periodSlotIds,
      subjectOfferingId: entry.subjectOfferingId, ...(entry.sectionId ? { sectionId: entry.sectionId } : {}),
      ...(entry.subjectBatchId ? { subjectBatchId: entry.subjectBatchId } : {}),
      ...(entry.teachingGroupId ? { teachingGroupId: entry.teachingGroupId } : {}),
      teachingAssignmentIds: entry.teachingAssignmentIds, ...(entry.roomId ? { roomId: entry.roomId } : {}),
      ...(entry.parallelBlockId ? { parallelBlockId: entry.parallelBlockId } : {}), entryType: entry.entryType, status: "ACTIVE",
    });
  }
  return revision;
}
async function calculateTimetableReadiness(campusId: string, academicYearId: string, tenantId: string, store: PlanningStore, scope?: PlanningDocument) {
  const allOfferings = await store.list("subject_offerings", tenantId, { campusId, academicYearId, status: "ACTIVE" }), assignments = await store.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }), groups = await store.list("teaching_groups", tenantId, { campusId, academicYearId, status: "ACTIVE" }), memberships = await store.list("teaching_group_memberships", tenantId, { status: "ACTIVE" }), sections = await store.list("academics_sections", tenantId, { campusId, status: "ACTIVE" }), batches = await store.list("subject_batches", tenantId, { campusId, academicYearId, status: "ACTIVE" }), batchMemberships = await store.list("subject_batch_memberships", tenantId, { status: "ACTIVE" }), campusAssignments = await store.list("employee_campus_assignments", tenantId, { campusId, availableForTeaching: true, status: "ACTIVE" }), eligibility = await store.list("teacher_subject_eligibility", tenantId, { status: "ACTIVE" }), curriculumSubjects = await store.list("curriculum_subjects", tenantId, { status: "ACTIVE" });
  const scopedGroupIds = scope?.scopeType === "SECTION" && typeof scope.sectionId === "string"
    ? new Set(groups.filter((group) => group.homeSectionId === scope.sectionId || (Array.isArray(group.sourceSectionIds) && group.sourceSectionIds.includes(scope.sectionId))).map((group) => String(group.id)))
    : undefined;
  const offerings = scope?.scopeType === "ACADEMIC_LEVEL" && typeof scope.academicLevelId === "string"
    ? allOfferings.filter((offering) => {
      const section = sections.find((item) => item.id === offering.sectionId), batch = batches.find((item) => item.id === offering.subjectBatchId);
      return section?.classId === scope.academicLevelId || batch?.academicLevelId === scope.academicLevelId;
    })
    : scope?.scopeType === "SECTION" && typeof scope.sectionId === "string"
      ? allOfferings.filter((offering) => offering.sectionId === scope.sectionId || scopedGroupIds?.has(String(offering.teachingGroupId)))
      : allOfferings;
  const coversOffering = (record: PlanningDocument, offering: PlanningDocument) => {
    const from = new Date(String(record.effectiveFrom)).getTime(), until = record.effectiveUntil ? new Date(String(record.effectiveUntil)).getTime() : Number.POSITIVE_INFINITY;
    const offeringFrom = new Date(String(offering.effectiveFrom)).getTime(), offeringUntil = offering.effectiveUntil ? new Date(String(offering.effectiveUntil)).getTime() : Number.POSITIVE_INFINITY;
    return from <= offeringFrom && until >= offeringUntil;
  };
  const issues = offerings.flatMap((offering) => {
    const messages: string[] = [], group = groups.find((item) => item.id === offering.teachingGroupId), section = sections.find((item) => item.id === offering.sectionId), batch = batches.find((item) => item.id === offering.subjectBatchId);
    const primary = assignments.filter((assignment) => assignment.subjectOfferingId === offering.id && assignment.assignmentRole === "PRIMARY" && coversOffering(assignment, offering));
    if (offering.targetType === "SECTION" && !section) messages.push("Section is missing");
    else if (offering.targetType === "SUBJECT_BATCH" && !batch) messages.push("Subject batch is missing");
    else if (!offering.targetType && !group) messages.push("Legacy teaching group is missing");
    if (primary.length !== 1) messages.push(primary.length ? "More than one primary teacher covers this offering" : "Primary teacher is missing");
    if (group && group.type !== "SECTION" && !memberships.some((membership) => membership.teachingGroupId === group.id && coversOffering(membership, offering))) messages.push("Teaching group has no active members for the offering period");
    if (batch && !batchMemberships.some((membership) => membership.subjectBatchId === batch.id && coversOffering(membership, offering))) messages.push("Subject batch has no active members for the offering period");
    if (Number(offering.requiredPeriodsPerWeek ?? 0) < 1) messages.push("Required periods are missing");
    for (const assignment of primary) {
      if (!campusAssignments.some((access) => access.employeeId === assignment.employeeId && coversOffering(access, offering))) messages.push("Primary teacher has no campus access covering the offering period");
      const curriculum = curriculumSubjects.find((item) => item.id === offering.curriculumSubjectId);
      if (!curriculum || !eligibility.some((item) => item.employeeId === assignment.employeeId && item.subjectCatalogueId === curriculum.subjectCatalogueId && coversOffering(item, offering))) {
        if (assignment.eligibilityStatus !== "OVERRIDDEN" || !String(assignment.eligibilityOverrideReason ?? "").trim()) messages.push("Primary teacher eligibility is missing");
      }
    }
    return messages.map((message) => ({ subjectOfferingId: offering.id, message }));
  });
  return { campusId, academicYearId, totalOfferings: offerings.length, readyOfferings: offerings.length - new Set(issues.map((issue) => issue.subjectOfferingId)).size, issues, ready: offerings.length > 0 && issues.length === 0 };
}
export async function timetableReadiness(campusId: string, academicYearId: string, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "read"); const store = repository(deps), tenantId = tenant(ctx);
  return calculateTimetableReadiness(campusId, academicYearId, tenantId, store);
}
export async function validateTimetable(timetableVersionId: string, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "validate"); const store = repository(deps), tenantId = tenant(ctx), version = await requireRecord(store, "timetable_versions", tenantId, timetableVersionId, "timetable version was not found");
  const entries = await store.list("timetable_entries", tenantId, { timetableVersionId, status: "ACTIVE" }), assignments = await store.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }), offerings = await offeringsForVersion(store, tenantId, version), slots = await store.list("timetable_period_slots", tenantId, { periodSetId: version.periodSetId, status: "ACTIVE" }), rooms = await store.list("rooms", tenantId, { status: "ACTIVE" }), groups = await store.list("teaching_groups", tenantId, { status: "ACTIVE" }), memberships = await store.list("teaching_group_memberships", tenantId, { status: "ACTIVE" }), batchMemberships = await store.list("subject_batch_memberships", tenantId, { status: "ACTIVE" }), availability = await store.list("teacher_availability", tenantId, { academicYearId: version.academicYearId, status: "ACTIVE" }), parallelBlocks = await store.list("parallel_timetable_blocks", tenantId, { academicYearId: version.academicYearId, status: "ACTIVE" }), travelRules = await store.list("campus_travel_rules", tenantId, { status: "ACTIVE" }), versions = await store.list("timetable_versions", tenantId, { academicYearId: version.academicYearId }), conflicts: Array<Record<string, unknown>> = [], occupied = new Map<string, PlanningDocument>();
  const otherVersions = versions.filter((item) => item.id !== timetableVersionId && ["DRAFT", "VALIDATED", "PUBLISHED"].includes(String(item.status))), externalEntries: Array<{ entry: PlanningDocument; version: PlanningDocument; slots: PlanningDocument[] }> = [];
  for (const otherVersion of otherVersions) { const otherSlots = await store.list("timetable_period_slots", tenantId, { periodSetId: otherVersion.periodSetId, status: "ACTIVE" }); for (const entry of await store.list("timetable_entries", tenantId, { timetableVersionId: otherVersion.id, status: "ACTIVE" })) externalEntries.push({ entry, version: otherVersion, slots: otherSlots }); }
  for (const entry of entries) for (const slotId of Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds : []) {
    for (const assignmentId of Array.isArray(entry.teachingAssignmentIds) ? entry.teachingAssignmentIds : []) { const assignment = assignments.find((item) => item.id === assignmentId), employeeId = assignment?.employeeId; if (!employeeId) continue; const key = `${entry.dayOfWeek}|${slotId}|teacher|${employeeId}`; if (occupied.has(key)) conflicts.push({ conflictType: "TEACHER_DOUBLE_BOOKING", severity: "HARD", employeeId, timetableEntryIds: [occupied.get(key)!.id, entry.id], message: "Teacher is assigned to two lessons at the same time" }); occupied.set(key, entry);
      const slot = slots.find((item) => item.id === slotId); if (slot && availability.some((item) => item.employeeId === employeeId && item.dayOfWeek === entry.dayOfWeek && ["BLOCKED", "UNAVAILABLE"].includes(String(item.availabilityType)) && String(item.startTime) < String(slot.endTime) && String(slot.startTime) < String(item.endTime))) conflicts.push({ conflictType: "TEACHER_UNAVAILABLE", severity: "HARD", employeeId, timetableEntryIds: [entry.id], message: "Teacher is scheduled during blocked availability" });
      if (slot) for (const external of externalEntries.filter((item) => item.entry.dayOfWeek === entry.dayOfWeek)) {
        const externalAssignmentIds = Array.isArray(external.entry.teachingAssignmentIds) ? external.entry.teachingAssignmentIds : [], sameTeacher = externalAssignmentIds.some((id) => assignments.find((assignment) => assignment.id === id)?.employeeId === employeeId); if (!sameTeacher || external.version.campusId === version.campusId) continue;
        for (const externalSlotId of Array.isArray(external.entry.periodSlotIds) ? external.entry.periodSlotIds : []) { const externalSlot = external.slots.find((item) => item.id === externalSlotId); if (!externalSlot) continue; const overlaps = String(slot.startTime) < String(externalSlot.endTime) && String(externalSlot.startTime) < String(slot.endTime); if (overlaps) conflicts.push({ conflictType: "CROSS_CAMPUS_TEACHER_DOUBLE_BOOKING", severity: "HARD", employeeId, timetableEntryIds: [external.entry.id, entry.id], message: "Teacher is scheduled in two campuses at the same time" }); else { const rule = travelRules.find((item) => (item.sourceCampusId === external.version.campusId && item.targetCampusId === version.campusId) || (item.targetCampusId === external.version.campusId && item.sourceCampusId === version.campusId)); if (rule) { const gap = Math.max(minutes(String(slot.startTime)) - minutes(String(externalSlot.endTime)), minutes(String(externalSlot.startTime)) - minutes(String(slot.endTime))); if (gap >= 0 && gap < Number(rule.minimumTravelMinutes)) conflicts.push({ conflictType: "CAMPUS_TRAVEL_TIME", severity: "HARD", employeeId, timetableEntryIds: [external.entry.id, entry.id], message: "Teacher does not have enough travel time between campuses" }); } } }
      }
    }
    for (const [type, value] of [["SECTION", entry.sectionId], ["SUBJECT_BATCH", entry.subjectBatchId], ["GROUP", entry.teachingGroupId], ["ROOM", entry.roomId]] as const) if (typeof value === "string") { const key = `${entry.dayOfWeek}|${slotId}|${type}|${value}`; if (occupied.has(key)) conflicts.push({ conflictType: `${type}_DOUBLE_BOOKING`, severity: "HARD", ...(type === "ROOM" ? { roomId: value } : { targetId: value }), timetableEntryIds: [occupied.get(key)!.id, entry.id], message: `${type === "ROOM" ? "Room" : type === "SECTION" ? "Section" : type === "SUBJECT_BATCH" ? "Subject batch" : "Teaching group"} is assigned twice at the same time` }); occupied.set(key, entry); }
  }
  for (const offering of offerings) {
    const ownEntries = entries.filter((entry) => entry.subjectOfferingId === offering.id), scheduled = ownEntries.reduce((sum, entry) => sum + (Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds.length : 0), 0);
    if (scheduled < Number(offering.requiredPeriodsPerWeek ?? 0)) conflicts.push({ conflictType: "MISSING_WEEKLY_PERIODS", severity: "HARD", subjectOfferingId: offering.id, message: `Offering requires ${Number(offering.requiredPeriodsPerWeek)} weekly periods but only ${scheduled} are scheduled` });
    if (scheduled > Number(offering.requiredPeriodsPerWeek ?? 0)) conflicts.push({ conflictType: "EXCESS_WEEKLY_PERIODS", severity: "HARD", subjectOfferingId: offering.id, message: "Offering exceeds configured weekly periods" });
    for (const day of new Set(ownEntries.map((entry) => entry.dayOfWeek))) { const daily = ownEntries.filter((entry) => entry.dayOfWeek === day).reduce((sum, entry) => sum + (Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds.length : 0), 0); if (typeof offering.maximumPeriodsPerDay === "number" && daily > offering.maximumPeriodsPerDay) conflicts.push({ conflictType: "MAX_PERIODS_PER_DAY", severity: "HARD", subjectOfferingId: offering.id, message: "Offering exceeds maximum periods per day" }); }
    for (const entry of ownEntries) if (typeof entry.roomId === "string") { const room = rooms.find((item) => item.id === entry.roomId), group = groups.find((item) => item.id === entry.teachingGroupId), groupSize = typeof entry.subjectBatchId === "string" ? batchMemberships.filter((item) => item.subjectBatchId === entry.subjectBatchId).length : memberships.filter((item) => item.teachingGroupId === group?.id).length; if (room && groupSize > Number(room.capacity ?? 0)) conflicts.push({ conflictType: "ROOM_CAPACITY", severity: "HARD", roomId: room.id, targetId: entry.subjectBatchId ?? group?.id, timetableEntryIds: [entry.id], message: "Room capacity is smaller than the scheduled group" }); if (offering.preferredRoomTypeId && room?.roomType !== offering.preferredRoomTypeId && room?.id !== offering.preferredRoomTypeId) conflicts.push({ conflictType: "REQUIRED_ROOM_TYPE", severity: "HARD", roomId: room?.id, subjectOfferingId: offering.id, timetableEntryIds: [entry.id], message: "Offering is scheduled in an incompatible room" }); }
  }
  for (const block of parallelBlocks) {
    const required = Array.isArray(block.requiredOfferingIds) ? block.requiredOfferingIds : [], blockEntries = entries.filter((entry) => required.includes(entry.subjectOfferingId));
    const signatures = new Set(blockEntries.map((entry) => `${entry.dayOfWeek}|${Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds.join(",") : ""}`));
    for (const signature of signatures) { const present = new Set(blockEntries.filter((entry) => `${entry.dayOfWeek}|${Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds.join(",") : ""}` === signature).map((entry) => entry.subjectOfferingId)); if (required.some((id) => !present.has(id))) conflicts.push({ conflictType: "PARALLEL_BLOCK_MISMATCH", severity: "HARD", message: "Parallel offerings must run simultaneously" }); }
  }
  const startedAt = new Date(), runId = `timetable_validation_${crypto.randomUUID()}`, hardConflictCount = conflicts.length, run = await create(store, "timetable_validation_runs", tenantId, actor(ctx), "timetable_validation", { timetableVersionId, timetableVersionRevision: Number(version.version), entryRevision: timetableEntryRevision(entries), status: hardConflictCount ? "FAILED" : "PASSED", startedAt, completedAt: new Date(), hardConflictCount, warningCount: 0 });
  const saved = []; for (const conflict of conflicts) saved.push(await create(store, "timetable_conflicts", tenantId, actor(ctx), "timetable_conflict", { validationRunId: run.id, ...conflict, resolutionStatus: "OPEN" })); return { run, conflicts: saved };
}
export async function resolveTimetableConflict(id: string, overrideReason: string | undefined, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "validate"); const store = repository(deps), tenantId = tenant(ctx), current = await requireRecord(store, "timetable_conflicts", tenantId, id, "timetable conflict was not found"), now = new Date(), resolutionStatus = overrideReason?.trim() ? "OVERRIDDEN" : "RESOLVED";
  if (current.severity === "HARD" && resolutionStatus === "OVERRIDDEN" && !overrideReason?.trim()) throw new ValidationError([{ field: "overrideReason", message: "override reason is required" }]);
  const next = { ...current, resolutionStatus, resolvedBy: actor(ctx), resolvedAt: now, ...(overrideReason?.trim() ? { overrideReason: overrideReason.trim() } : {}), updatedAt: now, updatedBy: actor(ctx), version: Number(current.version) + 1 };
  const replaced = await store.replace("timetable_conflicts", tenantId, id, Number(current.version), next); if (!replaced) throw new ConflictError("conflict changed during resolution"); return view(replaced);
}
export async function generateTimetable(timetableVersionId: string, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "manage");
  const store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx);
  const version = await requireRecord(store, "timetable_versions", tenantId, timetableVersionId, "timetable version was not found");
  if (version.status !== "DRAFT") throw new ConflictError("only a draft timetable can be generated");
  if ((await store.list("timetable_entries", tenantId, { timetableVersionId, status: "ACTIVE" })).length) throw new ConflictError("automatic generation requires an empty draft; create a revision or remove draft entries first");
  const readiness = await calculateTimetableReadiness(String(version.campusId), String(version.academicYearId), tenantId, store, version);
  if (!readiness.ready) throw new ConflictError("all subjects and primary teachers in this timetable scope must be ready before generation");
  const [periodSet, slots, offerings, assignments, availability, rooms, versions] = await Promise.all([
    requireRecord(store, "timetable_period_sets", tenantId, String(version.periodSetId), "period set was not found"),
    store.list("timetable_period_slots", tenantId, { periodSetId: version.periodSetId, status: "ACTIVE" }),
    offeringsForVersion(store, tenantId, version),
    store.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }),
    store.list("teacher_availability", tenantId, { academicYearId: version.academicYearId, status: "ACTIVE" }),
    store.list("rooms", tenantId, { campusId: version.campusId, status: "ACTIVE" }),
    store.list("timetable_versions", tenantId, { academicYearId: version.academicYearId }),
  ]);
  const days = Array.isArray(periodSet.applicableDays) ? periodSet.applicableDays.map(String) : [];
  const teachingSlots = slots.filter((slot) => slot.slotType === "TEACHING").sort((a, b) => Number(a.sequence) - Number(b.sequence));
  if (!days.length || !teachingSlots.length) throw new ConflictError("working days and teaching periods are required before generation");
  const occupied = new Set<string>(), planned: Array<Record<string, unknown>> = [], unscheduled: Array<Record<string, unknown>> = [];
  // Other drafts are independent planning attempts and must not reserve teachers or rooms.
  // Only the published schedule is authoritative while a replacement is being prepared.
  const sameReplacementScope = (item: PlanningDocument) =>
    item.scopeType === version.scopeType &&
    item.campusId === version.campusId &&
    item.academicUnitId === version.academicUnitId &&
    item.programId === version.programId &&
    item.academicLevelId === version.academicLevelId &&
    item.sectionId === version.sectionId &&
    item.teachingGroupId === version.teachingGroupId;
  const activeVersions = versions.filter((item) =>
    item.id !== timetableVersionId && item.status === "PUBLISHED" && !sameReplacementScope(item));
  for (const otherVersion of activeVersions) {
    const otherSlots = await store.list("timetable_period_slots", tenantId, { periodSetId: otherVersion.periodSetId, status: "ACTIVE" });
    for (const entry of await store.list("timetable_entries", tenantId, { timetableVersionId: otherVersion.id, status: "ACTIVE" })) {
      for (const slotId of Array.isArray(entry.periodSlotIds) ? entry.periodSlotIds : []) {
        const slot = otherSlots.find((item) => item.id === slotId); if (!slot) continue;
        for (const assignmentId of Array.isArray(entry.teachingAssignmentIds) ? entry.teachingAssignmentIds : []) {
          const assignment = assignments.find((item) => item.id === assignmentId); if (assignment) occupied.add(`${entry.dayOfWeek}|${slot.startTime}|${slot.endTime}|TEACHER|${assignment.employeeId}`);
        }
      }
    }
  }
  const target = (offering: PlanningDocument) => offering.sectionId ? `SECTION|${offering.sectionId}` : offering.subjectBatchId ? `SUBJECT_BATCH|${offering.subjectBatchId}` : `GROUP|${offering.teachingGroupId}`;
  const orderedOfferings = [...offerings].sort((a, b) => Number(b.requiredConsecutiveSlots ?? 1) - Number(a.requiredConsecutiveSlots ?? 1) || String(a.id).localeCompare(String(b.id)));
  for (const offering of orderedOfferings) {
    const primary = assignments.find((item) => item.subjectOfferingId === offering.id && item.assignmentRole === "PRIMARY");
    if (!primary) { unscheduled.push({ subjectOfferingId: offering.id, remainingPeriods: offering.requiredPeriodsPerWeek, reason: "Primary teacher is missing" }); continue; }
    const consecutive = Math.max(1, Number(offering.requiredConsecutiveSlots ?? (offering.requiresConsecutivePeriods ? 2 : 1))), required = Number(offering.requiredPeriodsPerWeek ?? 0);
    let remaining = required, attempt = 0;
    const room = offering.preferredRoomTypeId ? rooms.find((item) => item.roomType === offering.preferredRoomTypeId || item.id === offering.preferredRoomTypeId) : undefined;
    if (offering.preferredRoomTypeId && !room) { unscheduled.push({ subjectOfferingId: offering.id, remainingPeriods: remaining, reason: "Required room type is unavailable" }); continue; }
    while (remaining > 0 && attempt < days.length * teachingSlots.length * 2) {
      const day = days[attempt % days.length]!, startIndex = Math.floor(attempt / days.length) % teachingSlots.length, count = Math.min(consecutive, remaining), selected = teachingSlots.slice(startIndex, startIndex + count);
      attempt += 1;
      if (selected.length !== count || selected.slice(1).some((slot, index) => String(selected[index]?.endTime) !== String(slot.startTime))) continue;
      const unavailable = selected.some((slot) => availability.some((item) => item.employeeId === primary.employeeId && item.dayOfWeek === day && item.availabilityType === "UNAVAILABLE" && String(item.startTime) < String(slot.endTime) && String(slot.startTime) < String(item.endTime)));
      const keys = selected.flatMap((slot) => [
        `${day}|${slot.id}|${target(offering)}`,
        `${day}|${slot.startTime}|${slot.endTime}|TEACHER|${primary.employeeId}`,
        ...(room ? [`${day}|${slot.id}|ROOM|${room.id}`] : []),
      ]);
      if (unavailable || keys.some((key) => occupied.has(key))) continue;
      keys.forEach((key) => occupied.add(key));
      planned.push({ timetableVersionId, dayOfWeek: day, periodSlotIds: selected.map((slot) => slot.id), subjectOfferingId: offering.id, ...(offering.sectionId ? { sectionId: offering.sectionId } : {}), ...(offering.subjectBatchId ? { subjectBatchId: offering.subjectBatchId } : {}), ...(offering.teachingGroupId ? { teachingGroupId: offering.teachingGroupId } : {}), teachingAssignmentIds: [primary.id], ...(room ? { roomId: room.id } : {}), ...(offering.parallelBlockId ? { parallelBlockId: offering.parallelBlockId } : {}), entryType: "REGULAR", status: "ACTIVE" });
      remaining -= count;
    }
    if (remaining) unscheduled.push({ subjectOfferingId: offering.id, remainingPeriods: remaining, reason: "No conflict-free period sequence is available" });
  }
  const saved = [];
  for (const entry of planned) saved.push(await create(store, "timetable_entries", tenantId, actorId, "timetable_entry", entry));
  const requiredLessons = offerings.reduce((sum, item) => sum + Number(item.requiredPeriodsPerWeek ?? 0), 0), placedLessons = requiredLessons - unscheduled.reduce((sum, item) => sum + Number(item.remainingPeriods ?? 0), 0);
  const run = await create(store, "timetable_generation_runs", tenantId, actorId, "timetable_generation", { timetableVersionId, status: unscheduled.length ? "PARTIAL" : "COMPLETED", requiredLessons, placedLessons, unscheduledLessons: unscheduled, generatedAt: new Date() });
  return { run, entries: saved, requiredLessons, placedLessons, unscheduledLessons: unscheduled, success: unscheduled.length === 0 };
}
export async function publishTimetable(timetableVersionId: string, validationRunId: string, ctx: RequestContext, deps?: TimetableDeps) {
  permit(ctx, "publish"); const store = repository(deps), tenantId = tenant(ctx), current = await requireRecord(store, "timetable_versions", tenantId, timetableVersionId, "timetable version was not found"), run = await requireRecord(store, "timetable_validation_runs", tenantId, validationRunId, "validation run was not found");
  if (run.timetableVersionId !== timetableVersionId || run.status !== "PASSED") throw new ConflictError("a passing validation run is required");
  const currentEntries = await store.list("timetable_entries", tenantId, { timetableVersionId, status: "ACTIVE" });
  if (Number(run.timetableVersionRevision) !== Number(current.version) || run.entryRevision !== timetableEntryRevision(currentEntries)) throw new ConflictError("timetable changed after validation; validate it again before publication");
  const readiness = await calculateTimetableReadiness(String(current.campusId), String(current.academicYearId), tenantId, store, current); if (!readiness.ready) throw new ConflictError("all subject offerings in this timetable scope must be ready before publication");
  const ownership = timetableOwnership(current);
  const activeVersions = await store.list("timetable_versions", tenantId, { campusId: current.campusId, academicYearId: current.academicYearId, ...ownership });
  for (const active of activeVersions.filter((item) => item.id !== timetableVersionId && ["DRAFT", "PUBLISHED"].includes(String(item.status)))) {
    const next = { ...active, status: "ARCHIVED", updatedAt: new Date(), updatedBy: actor(ctx), version: Number(active.version) + 1 };
    await store.replace("timetable_versions", tenantId, active.id, Number(active.version), next);
  }
  const now = new Date(), next = { ...current, status: "PUBLISHED", publishedAt: now, publishedBy: actor(ctx), updatedAt: now, updatedBy: actor(ctx), version: Number(current.version) + 1 }; const replaced = await store.replace("timetable_versions", tenantId, timetableVersionId, Number(current.version), next); if (!replaced) throw new ConflictError("timetable version changed during publication"); return view(replaced);
}
