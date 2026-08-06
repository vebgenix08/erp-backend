import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@school-erp/errors";
import { academicYearSubjectPlanRepository } from "../academic-year-subject-plans/academic-year-subject-plans.repository";
import { activateSubjectPlan } from "../academic-year-subject-plans/academic-year-subject-plans.service";
import { planningStore, type PlanningDocument, type PlanningStore } from "../planning-store/planning-store.repository";
import { programRepository, type ProgramRepository } from "../programs/programs.repository";
import { subjectCatalogueRepository } from "../subject-catalogue/subject-catalogue.repository";
import { createTimetableVersion, generateTimetable, validateTimetable } from "../timetable/timetable.service";

export interface ClassSetupDependencies { store?: PlanningStore; programs?: ProgramRepository }
const tenant = (ctx: RequestContext) => { const value = ctx.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (ctx: RequestContext) => { const value = ctx.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (ctx: RequestContext, action: "read" | "manage") => { if (!ctx.authContext?.user?.permissions.includes(`academics.timetable.${action}`)) throw new ForbiddenError(`permission academics.timetable.${action} is required`); };
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new BadRequestError(`${field} is required`); return value.trim(); };
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const positiveInteger = (value: unknown, field: string) => {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) throw new ValidationError([{ field, message: `${field} must be a positive whole number` }]);
  return result;
};
const isoDate = (value: unknown, field: string) => {
  const result = new Date(text(value, field));
  if (Number.isNaN(result.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]);
  return result;
};
const timeValue = (value: unknown, field: string) => {
  const result = text(value, field);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) throw new ValidationError([{ field, message: `${field} must use HH:mm` }]);
  return result;
};
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const repository = (deps?: ClassSetupDependencies) => deps?.store ?? planningStore();
const view = (record: PlanningDocument) => { const { _id: _ignored, ...value } = record; return value; };
const replace = async (store: PlanningStore, collection: Parameters<PlanningStore["replace"]>[0], tenantId: string, record: PlanningDocument, patch: Record<string, unknown>, actorId: string) => {
  const updated = { ...record, ...patch, updatedAt: new Date(), updatedBy: actorId, version: Number(record.version) + 1 };
  const saved = await store.replace(collection, tenantId, String(record.id), Number(record.version), updated);
  if (!saved) throw new ConflictError("Class Setup data changed during this request. Refresh and try again.");
  return saved;
};

async function classSetupData(classId: string, campusId: string, academicYearId: string, ctx: RequestContext, deps?: ClassSetupDependencies) {
  const store = repository(deps), tenantId = tenant(ctx);
  const academicClass = await store.get("academics_classes", tenantId, classId);
  if (!academicClass || academicClass.campusId !== campusId || academicClass.status !== "ACTIVE") throw new NotFoundError("active class was not found in the selected campus");
  const program = await (deps?.programs ?? programRepository).getById(tenantId, String(academicClass.programId));
  if (!program || program.campusId !== campusId || program.status !== "ACTIVE") throw new NotFoundError("active program was not found for the selected class");
  const [sections, plans, offerings, assignments, periodSets, versions, catalogue, curriculumSubjects] = await Promise.all([
    store.list("academics_sections", tenantId, { campusId, classId, status: "ACTIVE" }),
    store.list("academic_year_subject_plans", tenantId, { campusId, academicYearId, academicLevelId: classId, status: "ACTIVE" }),
    store.list("subject_offerings", tenantId, { campusId, academicYearId, status: "ACTIVE" }),
    store.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }),
    store.list("timetable_period_sets", tenantId, { campusId, academicYearId, academicUnitId: program.academicUnitId }),
    store.list("timetable_versions", tenantId, { campusId, academicYearId, academicLevelId: classId }),
    subjectCatalogueRepository.list(tenantId, {}),
    store.list("curriculum_subjects", tenantId),
  ]);
  const planIds = new Set(plans.map((item) => String(item.id)));
  const activeSectionIds = new Set(sections.map((item) => String(item.id)));
  const scopedOfferings = offerings.filter((item) => planIds.has(String(item.subjectPlanId)) && (!item.sectionId || activeSectionIds.has(String(item.sectionId))));
  const curriculumById = new Map(curriculumSubjects.map((item) => [String(item.id), item]));
  const catalogueById = new Map(catalogue.map((item) => [item.id, item]));
  const chosenPlans = [...new Map(plans.map((plan) => [String(plan.curriculumSubjectId), plan])).values()]
    .map((fallback) => plans
      .filter((plan) => plan.curriculumSubjectId === fallback.curriculumSubjectId)
      .sort((left, right) => scopedOfferings.filter((item) => item.subjectPlanId === right.id).length - scopedOfferings.filter((item) => item.subjectPlanId === left.id).length)[0] ?? fallback);
  const rows = chosenPlans.map((plan) => {
    const curriculum = curriculumById.get(String(plan.curriculumSubjectId));
    const subject = catalogueById.get(String(curriculum?.subjectCatalogueId ?? ""));
    const planOfferings = [...new Map(
      scopedOfferings
        .filter((item) => item.subjectPlanId === plan.id && item.sectionId)
        .map((item) => [String(item.sectionId ?? item.subjectBatchId ?? item.teachingGroupId), item]),
    ).values()];
    const primaryAssignments = planOfferings.flatMap((offering) => assignments.filter((item) => item.subjectOfferingId === offering.id && item.assignmentRole === "PRIMARY"));
    return {
      subjectPlanId: String(plan.id), subjectName: subject?.name ?? "Subject",
      curriculumSubjectId: String(plan.curriculumSubjectId),
      subjectCategory: String(curriculum?.subjectCategory ?? "CORE"),
      isMandatory: curriculum?.isMandatory !== false,
      periodsPerWeek: Array.isArray(plan.componentPlans) ? plan.componentPlans.reduce((sum, item) => sum + Number((item as Record<string, unknown>).plannedPeriodsPerWeek ?? 0), 0) : 0,
      offeringCount: planOfferings.length, sectionCount: sections.length,
      primaryTeacherIds: [...new Set(primaryAssignments.map((item) => String(item.employeeId)))],
      status: planOfferings.length === sections.length && primaryAssignments.length === planOfferings.length ? "READY" : "NEEDS_SETUP",
    };
  });
  const sortedPeriodSets = [...periodSets].sort((a, b) => new Date(String(b.updatedAt ?? b.createdAt ?? 0)).getTime() - new Date(String(a.updatedAt ?? a.createdAt ?? 0)).getTime());
  const sortedVersions = [...versions].sort((a, b) => Number(b.versionNumber ?? 0) - Number(a.versionNumber ?? 0));
  const currentVersion = sortedVersions.find((item) => ["DRAFT", "PUBLISHED"].includes(String(item.status)));
  const entries = currentVersion ? await store.list("timetable_entries", tenantId, { timetableVersionId: currentVersion.id, status: "ACTIVE" }) : [];
  const selectedPeriodSetId = currentVersion?.periodSetId ?? sortedPeriodSets[0]?.id;
  const slots = selectedPeriodSetId ? await store.list("timetable_period_slots", tenantId, { periodSetId: selectedPeriodSetId, status: "ACTIVE" }) : [];
  const scopedOfferingIds = new Set(scopedOfferings.map((item) => String(item.id)));
  const scopedAssignments = assignments.filter((item) => scopedOfferingIds.has(String(item.subjectOfferingId)));
  const offeringViews = scopedOfferings.map((item) => {
    const curriculum = curriculumById.get(String(item.curriculumSubjectId));
    const subject = catalogueById.get(String(curriculum?.subjectCatalogueId ?? ""));
    return { ...view(item), subjectName: subject?.name ?? "Subject" };
  });
  return { academicClass: view(academicClass), sections: sections.map(view), subjects: rows, periodSets: sortedPeriodSets.map(view), versions: sortedVersions.map(view), currentVersion: currentVersion ? view(currentVersion) : null, entries: entries.map(view), slots: slots.map(view), offerings: offeringViews, assignments: scopedAssignments.map(view) };
}

export async function getClassSetupWorkspace(value: unknown, ctx: RequestContext, deps?: ClassSetupDependencies) {
  permit(ctx, "read"); const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return classSetupData(text(input.classId, "classId"), text(input.campusId, "campusId"), text(input.academicYearId, "academicYearId"), ctx, deps);
}

export async function updateClassSetupSubject(value: unknown, ctx: RequestContext, deps?: ClassSetupDependencies) {
  permit(ctx, "manage");
  const input = object(value), classId = text(input.classId, "classId"), campusId = text(input.campusId, "campusId"), academicYearId = text(input.academicYearId, "academicYearId"), subjectPlanId = text(input.subjectPlanId, "subjectPlanId");
  const componentValues = input.componentPlans;
  if (!Array.isArray(componentValues) || componentValues.length === 0) throw new ValidationError([{ field: "componentPlans", message: "at least one component allocation is required" }]);
  const allocations = componentValues.map((item, index) => {
    const component = object(item);
    return { subjectComponentId: text(component.subjectComponentId, `componentPlans.${index}.subjectComponentId`), plannedPeriodsPerWeek: positiveInteger(component.plannedPeriodsPerWeek, `componentPlans.${index}.plannedPeriodsPerWeek`) };
  });
  if (new Set(allocations.map((item) => item.subjectComponentId)).size !== allocations.length) throw new ValidationError([{ field: "componentPlans", message: "a subject component cannot be repeated" }]);

  const store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx);
  const workspace = await classSetupData(classId, campusId, academicYearId, ctx, deps);
  if (!workspace.subjects.some((item) => item.subjectPlanId === subjectPlanId)) throw new NotFoundError("class subject was not found in the selected context");
  if (workspace.versions.some((item) => item.status === "PUBLISHED")) throw new ConflictError("Published timetable requirements are immutable. Configure the change in the next academic-year plan.");
  const plan = await store.get("academic_year_subject_plans", tenantId, subjectPlanId);
  if (!plan || plan.status !== "ACTIVE" || !Array.isArray(plan.componentPlans)) throw new NotFoundError("active class subject plan was not found");
  const existingComponents = new Set(plan.componentPlans.map((item) => String(object(item).subjectComponentId)));
  if (allocations.some((item) => !existingComponents.has(item.subjectComponentId)) || allocations.length !== existingComponents.size) throw new ValidationError([{ field: "componentPlans", message: "allocations must include every component in the class subject" }]);
  const allocationByComponent = new Map(allocations.map((item) => [item.subjectComponentId, item.plannedPeriodsPerWeek]));
  const componentPlans = plan.componentPlans.map((item) => ({ ...object(item), plannedPeriodsPerWeek: allocationByComponent.get(String(object(item).subjectComponentId)) }));
  await replace(store, "academic_year_subject_plans", tenantId, plan, { componentPlans }, actorId);
  const offerings = await store.list("subject_offerings", tenantId, { subjectPlanId, status: "ACTIVE" });
  for (const offering of offerings) {
    const plannedPeriods = allocationByComponent.get(String(offering.subjectComponentId));
    if (plannedPeriods) await replace(store, "subject_offerings", tenantId, offering, { requiredPeriodsPerWeek: plannedPeriods }, actorId);
  }
  return classSetupData(classId, campusId, academicYearId, ctx, deps);
}

export async function removeClassSetupSubject(value: unknown, ctx: RequestContext, deps?: ClassSetupDependencies) {
  permit(ctx, "manage");
  const input = object(value), classId = text(input.classId, "classId"), campusId = text(input.campusId, "campusId"), academicYearId = text(input.academicYearId, "academicYearId"), subjectPlanId = text(input.subjectPlanId, "subjectPlanId"), reason = text(input.reason, "reason");
  const store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx);
  const workspace = await classSetupData(classId, campusId, academicYearId, ctx, deps);
  if (!workspace.subjects.some((item) => item.subjectPlanId === subjectPlanId)) throw new NotFoundError("class subject was not found in the selected context");
  const offerings = await store.list("subject_offerings", tenantId, { subjectPlanId, status: "ACTIVE" });
  const offeringIds = new Set(offerings.map((item) => String(item.id)));
  for (const version of workspace.versions.filter((item) => item.status === "PUBLISHED")) {
    const publishedEntries = await store.list("timetable_entries", tenantId, { timetableVersionId: version.id, status: "ACTIVE" });
    if (publishedEntries.some((entry) => offeringIds.has(String(entry.subjectOfferingId)))) throw new ConflictError("This subject is used by a published timetable and cannot be removed.");
  }
  const plan = await store.get("academic_year_subject_plans", tenantId, subjectPlanId);
  if (!plan || plan.status !== "ACTIVE") throw new NotFoundError("active class subject plan was not found");
  const now = new Date();
  const [entries, assignments] = await Promise.all([
    store.list("timetable_entries", tenantId, { status: "ACTIVE" }),
    store.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }),
  ]);
  for (const entry of entries.filter((item) => offeringIds.has(String(item.subjectOfferingId)))) await replace(store, "timetable_entries", tenantId, entry, { status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason }, actorId);
  for (const assignment of assignments.filter((item) => offeringIds.has(String(item.subjectOfferingId)))) await replace(store, "teaching_assignments_v2", tenantId, assignment, { status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason }, actorId);
  for (const offering of offerings) await replace(store, "subject_offerings", tenantId, offering, { status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason }, actorId);
  await replace(store, "academic_year_subject_plans", tenantId, plan, { status: "CLOSED", closedAt: now, closedBy: actorId, closeReason: reason }, actorId);
  return classSetupData(classId, campusId, academicYearId, ctx, deps);
}

export async function saveClassSetupTiming(value: unknown, ctx: RequestContext, deps?: ClassSetupDependencies) {
  permit(ctx, "manage");
  const input = object(value), classId = text(input.classId, "classId"), campusId = text(input.campusId, "campusId"), academicYearId = text(input.academicYearId, "academicYearId"), name = text(input.name, "name");
  const days = Array.isArray(input.applicableDays) ? [...new Set(input.applicableDays.map((item, index) => text(item, `applicableDays.${index}`)))] : [];
  if (!days.length) throw new ValidationError([{ field: "applicableDays", message: "at least one working day is required" }]);
  const slotValues = input.slots;
  if (!Array.isArray(slotValues) || !slotValues.length) throw new ValidationError([{ field: "slots", message: "at least one period or break is required" }]);
  const slots = slotValues.map((item, index) => {
    const slot = object(item), startTime = timeValue(slot.startTime, `slots.${index}.startTime`), endTime = timeValue(slot.endTime, `slots.${index}.endTime`);
    if (minutes(startTime) >= minutes(endTime)) throw new ValidationError([{ field: `slots.${index}.endTime`, message: "end time must be after start time" }]);
    return { label: text(slot.label, `slots.${index}.label`), startTime, endTime, slotType: text(slot.slotType, `slots.${index}.slotType`) };
  }).sort((left, right) => left.startTime.localeCompare(right.startTime));
  for (let index = 1; index < slots.length; index += 1) if (minutes(slots[index]!.startTime) < minutes(slots[index - 1]!.endTime)) throw new ValidationError([{ field: `slots.${index}.startTime`, message: "periods and breaks cannot overlap" }]);
  if (!slots.some((slot) => slot.slotType === "TEACHING")) throw new ValidationError([{ field: "slots", message: "at least one teaching period is required" }]);

  const store = repository(deps), tenantId = tenant(ctx), actorId = actor(ctx), workspace = await classSetupData(classId, campusId, academicYearId, ctx, deps);
  const academicClass = await store.get("academics_classes", tenantId, classId);
  const program = academicClass ? await (deps?.programs ?? programRepository).getById(tenantId, String(academicClass.programId)) : null;
  if (!academicClass || !program) throw new NotFoundError("class and program were not found");
  const now = new Date(), periodSetId = `period_set_${crypto.randomUUID()}`, effectiveFrom = isoDate(input.effectiveFrom, "effectiveFrom"), effectiveUntil = input.effectiveUntil ? isoDate(input.effectiveUntil, "effectiveUntil") : undefined;
  if (effectiveUntil && effectiveUntil < effectiveFrom) throw new ValidationError([{ field: "effectiveUntil", message: "effectiveUntil must be on or after effectiveFrom" }]);
  await store.insert("timetable_period_sets", tenantId, { _id: periodSetId, id: periodSetId, tenantId, campusId, academicYearId, academicUnitId: program.academicUnitId, name, applicableDays: days, effectiveFrom, ...(effectiveUntil ? { effectiveUntil } : {}), preferences: { source: "CLASS_SETUP" }, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 });
  for (const [index, slot] of slots.entries()) {
    const id = `period_slot_${crypto.randomUUID()}`;
    await store.insert("timetable_period_slots", tenantId, { _id: id, id, tenantId, periodSetId, sequence: index + 1, ...slot, countsForTeachingWorkload: slot.slotType === "TEACHING", status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 });
  }
  if (workspace.currentVersion?.status === "DRAFT" && workspace.entries.length === 0) {
    const version = await store.get("timetable_versions", tenantId, String(workspace.currentVersion.id));
    if (version) await replace(store, "timetable_versions", tenantId, version, { periodSetId }, actorId);
  } else if (workspace.currentVersion) {
    if (workspace.currentVersion.status === "DRAFT") {
      const version = await store.get("timetable_versions", tenantId, String(workspace.currentVersion.id));
      if (version) await replace(store, "timetable_versions", tenantId, version, { status: "ARCHIVED", archivedAt: now, archivedBy: actorId }, actorId);
    }
    await createTimetableVersion({ campusId, academicYearId, academicUnitId: program.academicUnitId, name: `${academicClass.name} Timetable`, scopeType: "ACADEMIC_LEVEL", programId: program.id, academicLevelId: classId, periodSetId, effectiveFrom: effectiveFrom.toISOString(), ...(effectiveUntil ? { effectiveUntil: effectiveUntil.toISOString() } : {}), generatedBy: "MANUAL" }, ctx, { store });
  }
  return classSetupData(classId, campusId, academicYearId, ctx, deps);
}

export async function generateClassTimetable(value: unknown, ctx: RequestContext, deps?: ClassSetupDependencies) {
  permit(ctx, "manage"); actor(ctx);
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const classId = text(input.classId, "classId"), campusId = text(input.campusId, "campusId"), academicYearId = text(input.academicYearId, "academicYearId");
  let workspace = await classSetupData(classId, campusId, academicYearId, ctx, deps);
  if (!workspace.sections.length) throw new ConflictError("at least one active section is required");
  const planRepository = await academicYearSubjectPlanRepository();
  for (const row of workspace.subjects) await activateSubjectPlan(row.subjectPlanId, ctx, { repository: planRepository, planningStore: repository(deps) });
  workspace = await classSetupData(classId, campusId, academicYearId, ctx, deps);
  const incomplete = workspace.subjects.filter((item) => item.status !== "READY");
  if (incomplete.length) return { ...workspace, generation: { success: false, requiredLessons: 0, placedLessons: 0, remainingLessons: 0, issues: incomplete.map((item) => `${item.subjectName}: assign a primary teacher for every section`) }, validation: null };
  const requiredLessons = workspace.offerings.reduce((sum, item) => sum + Number((item as Record<string, unknown>).requiredPeriodsPerWeek ?? 0), 0);
  if (workspace.currentVersion?.status === "PUBLISHED" && workspace.entries.reduce((sum, item) => sum + (Array.isArray(item.periodSlotIds) ? item.periodSlotIds.length : 0), 0) === requiredLessons) {
    return { ...workspace, generation: { success: true, requiredLessons, placedLessons: requiredLessons, remainingLessons: 0, issues: [] }, validation: null };
  }
  let version = workspace.currentVersion?.status === "DRAFT" && workspace.entries.length === 0
    ? workspace.currentVersion
    : undefined;
  if (!version) {
    const periodSet = workspace.periodSets.find((item) => item.status === "ACTIVE") ?? workspace.periodSets[0];
    if (!periodSet) throw new ConflictError("timetable timings are not configured");
    version = await createTimetableVersion({ campusId, academicYearId, academicUnitId: String(workspace.academicClass.academicUnitId ?? periodSet.academicUnitId), name: `${workspace.academicClass.name} Timetable`, scopeType: "ACADEMIC_LEVEL", programId: String(workspace.academicClass.programId), academicLevelId: classId, periodSetId: String(periodSet.id), effectiveFrom: String(periodSet.effectiveFrom ?? new Date().toISOString()), ...(periodSet.effectiveUntil ? { effectiveUntil: String(periodSet.effectiveUntil) } : {}), generatedBy: "AUTOMATIC" }, ctx, { store: repository(deps) });
  }
  const result = await generateTimetable(String(version.id), ctx, { store: repository(deps) });
  const validation = await validateTimetable(String(version.id), ctx, { store: repository(deps) });
  const refreshed = await classSetupData(classId, campusId, academicYearId, ctx, deps);
  return { ...refreshed, generation: { success: result.success, requiredLessons: result.requiredLessons, placedLessons: result.placedLessons, remainingLessons: result.requiredLessons - result.placedLessons, issues: result.unscheduledLessons.map((item) => item.reason) }, validation };
}
