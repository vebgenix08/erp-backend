import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@school-erp/errors";
import { planningStore, type PlanningCollection, type PlanningDocument, type PlanningStore } from "../planning-store/planning-store.repository";
import { calculateWorkload } from "./faculty-planning.repository";
import type { WorkloadItem } from "./faculty-planning.model";
export interface FacultyPlanningDeps { store?: PlanningStore }
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const tenant = (ctx: RequestContext) => { const value = ctx.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (ctx: RequestContext) => { const value = ctx.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (ctx: RequestContext, action: string) => { const permission = `academics.faculty-planning.${action}` as Permission; if (!ctx.authContext?.user?.permissions.includes(permission)) throw new ForbiddenError(`permission ${permission} is required`); };
const text = (input: Record<string, unknown>, field: string) => { const value = input[field]; if (typeof value !== "string" || !value.trim()) throw new ValidationError([{ field, message: `${field} is required` }]); return value.trim(); };
const optionalText = (input: Record<string, unknown>, field: string) => typeof input[field] === "string" && input[field].trim() ? input[field].trim() : undefined;
const date = (input: Record<string, unknown>, field: string) => { const value = new Date(text(input, field)); if (Number.isNaN(value.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]); return value; };
const optionalDate = (input: Record<string, unknown>, field: string) => { const value = optionalText(input, field); if (!value) return undefined; const result = new Date(value); if (Number.isNaN(result.getTime())) throw new ValidationError([{ field, message: `${field} must be a valid date` }]); return result; };
const store = (deps?: FacultyPlanningDeps) => deps?.store ?? planningStore();
const view = (document: PlanningDocument) => { const { _id: _ignored, ...record } = document; return record; };
export const normalizeOfferingAssignmentStatus = (status: unknown): "ACTIVE" | "ENDED" | "CANCELLED" => {
  if (status === "ACTIVE" || status === "CANCELLED") return status;
  return "ENDED";
};
const create = async (repository: PlanningStore, collection: PlanningCollection, tenantId: string, actorId: string, prefix: string, input: Record<string, unknown>) => { const now = new Date(), id = `${prefix}_${crypto.randomUUID()}`; return view(await repository.insert(collection, tenantId, { _id: id, id, tenantId, ...input, createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 })); };
export async function listFacultyRecords(collection: PlanningCollection, filter: Record<string, unknown>, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "read");
  return (await store(deps).list(collection, tenant(ctx), filter)).map((document) => {
    const record = view(document);
    if (collection === "teaching_assignments_v2") {
      return { ...record, status: normalizeOfferingAssignmentStatus(record.status) };
    }
    if (collection === "teacher_availability") {
      return { ...record, availabilityType: record.availabilityType === "PREFERRED" ? "PREFERRED" : "BLOCKED" };
    }
    if (collection !== "teacher_workload_policies") return record;
    const multipliers = object(record.componentMultipliers);
    return { ...record, componentMultipliers: Object.entries(multipliers).map(([componentType, multiplier]) => ({ componentType, multiplier })) };
  });
}
export async function assignEmployeeCampus(value: unknown, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "manage"); const input = object(value), repository = store(deps), tenantId = tenant(ctx), employeeId = text(input, "employeeId"), campusId = text(input, "campusId");
  const effectiveFrom = date(input, "effectiveFrom"), effectiveUntil = optionalDate(input, "effectiveUntil");
  const existing = (await repository.list("employee_campus_assignments", tenantId, { employeeId, campusId, status: "ACTIVE" }))[0];
  if (!existing) return create(repository, "employee_campus_assignments", tenantId, actor(ctx), "employee_campus_assignment", { employeeId, campusId, assignmentType: text(input, "assignmentType"), availableForTeaching: input.availableForTeaching === true, effectiveFrom, ...(effectiveUntil ? { effectiveUntil } : {}), approvedBy: actor(ctx), status: "ACTIVE" });
  const existingFrom = new Date(String(existing.effectiveFrom));
  const existingUntil = existing.effectiveUntil ? new Date(String(existing.effectiveUntil)) : undefined;
  const merged = {
    ...existing,
    assignmentType: text(input, "assignmentType"),
    availableForTeaching: input.availableForTeaching === true || existing.availableForTeaching === true,
    effectiveFrom: existingFrom <= effectiveFrom ? existingFrom : effectiveFrom,
    ...(!existingUntil || !effectiveUntil ? { effectiveUntil: undefined } : { effectiveUntil: existingUntil >= effectiveUntil ? existingUntil : effectiveUntil }),
    approvedBy: actor(ctx),
    updatedAt: new Date(),
    updatedBy: actor(ctx),
    version: Number(existing.version) + 1,
  };
  const replaced = await repository.replace("employee_campus_assignments", tenantId, String(existing.id), Number(existing.version), merged);
  if (!replaced) throw new ConflictError("employee campus assignment changed during update");
  return view(replaced);
}
export async function addTeacherEligibility(value: unknown, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "manage"); const input = object(value), repository = store(deps), tenantId = tenant(ctx);
  return create(repository, "teacher_subject_eligibility", tenantId, actor(ctx), "teacher_subject_eligibility", { employeeId: text(input, "employeeId"), subjectCatalogueId: text(input, "subjectCatalogueId"), ...(optionalText(input, "curriculumId") ? { curriculumId: optionalText(input, "curriculumId") } : {}), ...(optionalText(input, "programId") ? { programId: optionalText(input, "programId") } : {}), ...(Array.isArray(input.academicLevelIds) ? { academicLevelIds: input.academicLevelIds } : {}), ...(Array.isArray(input.componentTypes) ? { componentTypes: input.componentTypes } : {}), ...(optionalText(input, "qualificationReference") ? { qualificationReference: optionalText(input, "qualificationReference") } : {}), ...(optionalText(input, "proficiencyLevel") ? { proficiencyLevel: optionalText(input, "proficiencyLevel") } : {}), effectiveFrom: date(input, "effectiveFrom"), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE" });
}
export async function assignOfferingTeacher(value: unknown, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "manage"); const input = object(value), repository = store(deps), tenantId = tenant(ctx), subjectOfferingId = text(input, "subjectOfferingId"), employeeId = text(input, "employeeId"), assignmentRole = text(input, "assignmentRole"), effectiveFrom = date(input, "effectiveFrom"), effectiveUntil = optionalDate(input, "effectiveUntil");
  const offering = await repository.get("subject_offerings", tenantId, subjectOfferingId); if (!offering) throw new NotFoundError("subject offering was not found");
  const covers = (record: PlanningDocument) => {
    const from = new Date(String(record.effectiveFrom)).getTime(), until = record.effectiveUntil ? new Date(String(record.effectiveUntil)).getTime() : Number.POSITIVE_INFINITY;
    const requestedUntil = effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
    return from <= effectiveFrom.getTime() && until >= requestedUntil;
  };
  const campusAccess = await repository.list("employee_campus_assignments", tenantId, { employeeId, campusId: offering.campusId, availableForTeaching: true, status: "ACTIVE" });
  if (!campusAccess.some(covers)) throw new ConflictError("teacher has no active teaching access covering the assignment period");
  const curriculumSubject = await repository.get("curriculum_subjects", tenantId, String(offering.curriculumSubjectId));
  if (!curriculumSubject) throw new ConflictError("offering curriculum subject was not found");
  const eligibility = await repository.list("teacher_subject_eligibility", tenantId, { employeeId, subjectCatalogueId: curriculumSubject.subjectCatalogueId, status: "ACTIVE" });
  const eligible = eligibility.some(covers), overrideReason = optionalText(input, "eligibilityOverrideReason");
  if (!eligible && !overrideReason) throw new ConflictError("eligibility override reason is required");
  const overlaps = (record: PlanningDocument) => {
    const from = new Date(String(record.effectiveFrom)).getTime(), until = record.effectiveUntil ? new Date(String(record.effectiveUntil)).getTime() : Number.POSITIVE_INFINITY;
    const requestedUntil = effectiveUntil?.getTime() ?? Number.POSITIVE_INFINITY;
    return from <= requestedUntil && effectiveFrom.getTime() <= until;
  };
  const overlappingPrimary = assignmentRole === "PRIMARY"
    ? (await repository.list("teaching_assignments_v2", tenantId, { subjectOfferingId, assignmentRole: "PRIMARY", status: "ACTIVE" })).filter(overlaps)
    : [];
  if (overlappingPrimary.length && input.replaceExistingPrimary !== true) throw new ConflictError("offering already has an overlapping primary teacher");
  if (overlappingPrimary.length) {
    const now = new Date();
    for (const current of overlappingPrimary) {
      const replaced = await repository.replace("teaching_assignments_v2", tenantId, String(current.id), Number(current.version), {
        ...current,
        status: "ENDED",
        effectiveUntil: new Date(effectiveFrom.getTime() - 1),
        updatedAt: now,
        updatedBy: actor(ctx),
        version: Number(current.version) + 1,
      });
      if (!replaced) throw new ConflictError("teacher assignment changed during replacement");
    }
  }
  const created = await create(repository, "teaching_assignments_v2", tenantId, actor(ctx), "teaching_assignment", { subjectOfferingId, employeeId, assignmentRole, ...(input.workloadSharePercentage !== undefined ? { workloadSharePercentage: Number(input.workloadSharePercentage) } : {}), effectiveFrom, ...(effectiveUntil ? { effectiveUntil } : {}), eligibilityStatus: eligible ? "VERIFIED" : "OVERRIDDEN", ...(overrideReason ? { eligibilityOverrideReason: overrideReason, eligibilityOverriddenBy: actor(ctx) } : {}), status: "ACTIVE" });
  if (assignmentRole === "PRIMARY" && overlappingPrimary.length) {
    const replacedIds = new Set(overlappingPrimary.map((item) => String(item.id)));
    const entries = await repository.list("timetable_entries", tenantId, { subjectOfferingId, status: "ACTIVE" });
    for (const entry of entries) {
      const version = await repository.get("timetable_versions", tenantId, String(entry.timetableVersionId));
      if (version?.status !== "DRAFT") continue;
      const currentIds = Array.isArray(entry.teachingAssignmentIds) ? entry.teachingAssignmentIds.map(String) : [];
      if (!currentIds.some((id) => replacedIds.has(id))) continue;
      const teachingAssignmentIds = [...currentIds.filter((id) => !replacedIds.has(id)), String(created.id)];
      const replaced = await repository.replace("timetable_entries", tenantId, String(entry.id), Number(entry.version), { ...entry, teachingAssignmentIds, updatedAt: new Date(), updatedBy: actor(ctx), version: Number(entry.version) + 1 });
      if (!replaced) throw new ConflictError("draft timetable entry changed during teacher replacement");
    }
  }
  return created;
}
export async function addAcademicResponsibility(value: unknown, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "manage"); const input = object(value), type = text(input, "responsibilityType"), sectionId = optionalText(input, "sectionId");
  if (["CLASS_TEACHER", "SECTION_INCHARGE"].includes(type) && !sectionId) throw new ValidationError([{ field: "sectionId", message: "sectionId is required for this responsibility" }]);
  const repository = store(deps), tenantId = tenant(ctx), academicYearId = text(input, "academicYearId"), effectiveFrom = date(input, "effectiveFrom");
  const existing = sectionId ? await repository.list("academic_responsibilities", tenantId, { academicYearId, sectionId, responsibilityType: type, status: "ACTIVE" }) : [];
  if (existing.length && input.replaceExisting !== true) throw new ConflictError("section already has an active responsibility of this type");
  for (const current of existing) {
    const replaced = await repository.replace("academic_responsibilities", tenantId, String(current.id), Number(current.version), { ...current, status: "INACTIVE", effectiveUntil: new Date(effectiveFrom.getTime() - 1), updatedAt: new Date(), updatedBy: actor(ctx), version: Number(current.version) + 1 });
    if (!replaced) throw new ConflictError("section responsibility changed during replacement");
  }
  return create(repository, "academic_responsibilities", tenantId, actor(ctx), "academic_responsibility", { employeeId: text(input, "employeeId"), academicYearId, campusId: text(input, "campusId"), responsibilityType: type, ...(optionalText(input, "academicUnitId") ? { academicUnitId: optionalText(input, "academicUnitId") } : {}), ...(optionalText(input, "programId") ? { programId: optionalText(input, "programId") } : {}), ...(optionalText(input, "academicLevelId") ? { academicLevelId: optionalText(input, "academicLevelId") } : {}), ...(sectionId ? { sectionId } : {}), effectiveFrom, ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), status: "ACTIVE" });
}
export async function setTeacherAvailability(value: unknown, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "manage"); const input = object(value), startTime = text(input, "startTime"), endTime = text(input, "endTime"); if (startTime >= endTime) throw new ValidationError([{ field: "endTime", message: "endTime must be after startTime" }]);
  const availabilityType = text(input, "availabilityType");
  if (!["BLOCKED", "PREFERRED"].includes(availabilityType)) throw new ValidationError([{ field: "availabilityType", message: "availabilityType must be BLOCKED or PREFERRED" }]);
  const dayOfWeek = text(input, "dayOfWeek").toUpperCase();
  if (!["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].includes(dayOfWeek)) throw new ValidationError([{ field: "dayOfWeek", message: "dayOfWeek must be a working day" }]);
  const repository = store(deps), tenantId = tenant(ctx), actorId = actor(ctx), employeeId = text(input, "employeeId"), academicYearId = text(input, "academicYearId"), effectiveFrom = date(input, "effectiveFrom"), effectiveUntil = optionalDate(input, "effectiveUntil");
  if (effectiveUntil && effectiveUntil < effectiveFrom) throw new ValidationError([{ field: "effectiveUntil", message: "effectiveUntil must be after effectiveFrom" }]);
  const values = { employeeId, ...(optionalText(input, "campusId") ? { campusId: optionalText(input, "campusId") } : { campusId: undefined }), academicYearId, dayOfWeek, startTime, endTime, availabilityType, effectiveFrom, ...(effectiveUntil ? { effectiveUntil } : { effectiveUntil: undefined }), ...(optionalText(input, "reason") ? { reason: optionalText(input, "reason") } : { reason: undefined }), status: "ACTIVE" };
  const id = optionalText(input, "id");
  if (!id) return create(repository, "teacher_availability", tenantId, actorId, "teacher_availability", values);
  const existing = await repository.get("teacher_availability", tenantId, id);
  if (!existing || existing.employeeId !== employeeId || existing.academicYearId !== academicYearId) throw new NotFoundError("teacher availability exception was not found");
  const replaced = await repository.replace("teacher_availability", tenantId, id, Number(existing.version), { ...existing, ...values, updatedAt: new Date(), updatedBy: actorId, version: Number(existing.version) + 1 });
  if (!replaced) throw new ConflictError("teacher availability changed during update");
  return view(replaced);
}
export async function saveWorkloadPolicy(value: unknown, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "manage"); const input = object(value), repository = store(deps), tenantId = tenant(ctx);
  if (!Array.isArray(input.componentMultipliers)) throw new ValidationError([{ field: "componentMultipliers", message: "componentMultipliers is required" }]);
  const componentMultipliers = Object.fromEntries(input.componentMultipliers.map((item) => { const value = object(item), componentType = text(value, "componentType"), multiplier = Number(value.multiplier); if (!Number.isFinite(multiplier) || multiplier <= 0) throw new ValidationError([{ field: "componentMultipliers", message: "multiplier must be positive" }]); return [componentType, multiplier]; }));
  const scopeType = optionalText(input, "scopeType") ?? "DEFAULT", employeeId = optionalText(input, "employeeId"), effectiveFrom = optionalDate(input, "effectiveFrom"), reason = optionalText(input, "reason");
  if (!["DEFAULT", "STAFF_TYPE", "DESIGNATION", "EMPLOYEE"].includes(scopeType)) throw new ValidationError([{ field: "scopeType", message: "scopeType is invalid" }]);
  if (scopeType === "EMPLOYEE" && (!employeeId || !effectiveFrom || !reason)) throw new ValidationError([{ field: "employeeId", message: "employeeId, effectiveFrom and reason are required for a teacher override" }]);
  const positiveLimit = (field: string) => { if (input[field] === undefined) return undefined; const result = Number(input[field]); if (!Number.isFinite(result) || result <= 0) throw new ValidationError([{ field, message: `${field} must be positive` }]); return result; };
  const maximumContactPeriodsPerWeek = positiveLimit("maximumContactPeriodsPerWeek"), maximumWeightedUnitsPerWeek = positiveLimit("maximumWeightedUnitsPerWeek"), maximumPeriodsPerDay = positiveLimit("maximumPeriodsPerDay"), maximumConsecutivePeriods = positiveLimit("maximumConsecutivePeriods");
  const record = await create(repository, "teacher_workload_policies", tenantId, actor(ctx), "teacher_workload_policy", { scopeType, ...(employeeId ? { employeeId } : {}), ...(optionalText(input, "academicUnitId") ? { academicUnitId: optionalText(input, "academicUnitId") } : {}), ...(optionalText(input, "staffType") ? { staffType: optionalText(input, "staffType") } : {}), ...(optionalText(input, "designationId") ? { designationId: optionalText(input, "designationId") } : {}), ...(maximumContactPeriodsPerWeek !== undefined ? { maximumContactPeriodsPerWeek } : {}), ...(maximumWeightedUnitsPerWeek !== undefined ? { maximumWeightedUnitsPerWeek } : {}), ...(maximumPeriodsPerDay !== undefined ? { maximumPeriodsPerDay } : {}), ...(maximumConsecutivePeriods !== undefined ? { maximumConsecutivePeriods } : {}), ...(effectiveFrom ? { effectiveFrom } : {}), ...(optionalDate(input, "effectiveUntil") ? { effectiveUntil: optionalDate(input, "effectiveUntil") } : {}), ...(reason ? { reason } : {}), componentMultipliers, status: "ACTIVE" });
  return { ...record, componentMultipliers: Object.entries(componentMultipliers).map(([componentType, multiplier]) => ({ componentType, multiplier })) };
}
export async function facultyWorkload(employeeId: string, ctx: RequestContext, deps?: FacultyPlanningDeps) {
  permit(ctx, "read"); const repository = store(deps), tenantId = tenant(ctx), assignments = await repository.list("teaching_assignments_v2", tenantId, { employeeId, status: "ACTIVE" }), offerings = await repository.list("subject_offerings", tenantId, { status: "ACTIVE" }), components = await repository.list("subject_components", tenantId, { status: "ACTIVE" }), policies = await repository.list("teacher_workload_policies", tenantId, { status: "ACTIVE" });
  const items: WorkloadItem[] = assignments.flatMap((assignment) => { const offering = offerings.find((item) => item.id === assignment.subjectOfferingId), component = components.find((item) => item.id === offering?.subjectComponentId); if (!offering || typeof offering.campusId !== "string") return []; const periods = Number(offering.requiredPeriodsPerWeek ?? 0), multiplier = Number(component?.workloadMultiplier ?? 1), share = Number(assignment.workloadSharePercentage ?? 100) / 100; return [{ employeeId, campusId: offering.campusId, contactPeriods: periods * share, weightedUnits: periods * multiplier * share }]; });
  const policy = policies[0];
  const maximumContactPeriodsPerWeek = typeof policy?.maximumContactPeriodsPerWeek === "number" ? policy.maximumContactPeriodsPerWeek : undefined;
  const maximumWeightedUnitsPerWeek = typeof policy?.maximumWeightedUnitsPerWeek === "number" ? policy.maximumWeightedUnitsPerWeek : undefined;
  return calculateWorkload(employeeId, items, { ...(maximumContactPeriodsPerWeek !== undefined ? { maximumContactPeriodsPerWeek } : {}), ...(maximumWeightedUnitsPerWeek !== undefined ? { maximumWeightedUnitsPerWeek } : {}) });
}
