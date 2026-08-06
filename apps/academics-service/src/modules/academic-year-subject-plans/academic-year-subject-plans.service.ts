import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { subjectComponentRepository, type SubjectComponentRepository } from "../subject-components/subject-components.repository";
import { academicYearSubjectPlanRepository, type AcademicYearSubjectPlanRepository } from "./academic-year-subject-plans.repository";
import { validateAcademicYearSubjectPlan } from "./academic-year-subject-plans.validator";
import { planningStore, type PlanningStore } from "../planning-store/planning-store.repository";
export interface SubjectPlanDeps { repository?: AcademicYearSubjectPlanRepository; componentRepository?: SubjectComponentRepository; planningStore?: PlanningStore }
const tenant = (ctx: RequestContext) => { const value = ctx.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (ctx: RequestContext) => { const value = ctx.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (ctx: RequestContext, action: string) => { if (!ctx.authContext?.user?.permissions.includes(`academics.subject-plan.${action}`)) throw new ForbiddenError(`permission academics.subject-plan.${action} is required`); };
const deps = async (value?: SubjectPlanDeps) => ({ repository: value?.repository ?? await academicYearSubjectPlanRepository(), componentRepository: value?.componentRepository ?? await subjectComponentRepository() });
const view = (record: NonNullable<Awaited<ReturnType<AcademicYearSubjectPlanRepository["get"]>>>) => ({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), activatedAt: record.activatedAt?.toISOString(), closedAt: record.closedAt?.toISOString() });
export async function listSubjectPlans(ctx: RequestContext, filter: Record<string, unknown>, injected?: SubjectPlanDeps) { permit(ctx, "read"); const { repository } = await deps(injected); return (await repository.list(tenant(ctx), filter)).map(view); }
export async function createSubjectPlan(input: unknown, ctx: RequestContext, injected?: SubjectPlanDeps) {
  permit(ctx, "create"); const tenantId = tenant(ctx), parsed = validateAcademicYearSubjectPlan(input), repositories = await deps(injected);
  for (const component of parsed.componentPlans) { const record = await repositories.componentRepository.get(tenantId, component.subjectComponentId); if (!record || record.curriculumSubjectId !== parsed.curriculumSubjectId || record.status !== "ACTIVE") throw new NotFoundError("active subject component was not found for the curriculum subject"); }
  return view(await repositories.repository.create(tenantId, actor(ctx), parsed));
}
export async function activateSubjectPlan(id: string, ctx: RequestContext, injected?: SubjectPlanDeps) {
  permit(ctx, "activate"); const tenantId = tenant(ctx), actorId = actor(ctx), { repository } = await deps(injected);
  const current = await repository.get(tenantId, id);
  if (!current) throw new NotFoundError("subject plan was not found");
  if (current.status === "CLOSED") throw new ConflictError("a closed subject plan cannot be activated");
  const record = current.status === "DRAFT" ? await repository.activate(tenantId, actorId, id) : current;
  if (!record) throw new NotFoundError("subject plan was not found");
  if (record.appliesToAllSections) {
    const store = injected?.planningStore ?? planningStore(), sections = await store.list("academics_sections", tenantId, { campusId: record.campusId, classId: record.academicLevelId, status: "ACTIVE" });
    for (const section of sections) {
      for (const component of record.componentPlans) {
        const duplicate = await store.list("subject_offerings", tenantId, { subjectPlanId: record.id, subjectComponentId: component.subjectComponentId, targetType: "SECTION", sectionId: section.id, status: "ACTIVE" });
        if (duplicate.length) continue; const source = await (injected?.componentRepository ?? await subjectComponentRepository()).get(tenantId, component.subjectComponentId); if (!source) throw new NotFoundError("subject component was not found during plan activation");
        const now = new Date(), offeringId = `subject_offering_${crypto.randomUUID()}`;
        await store.insert("subject_offerings", tenantId, { _id: offeringId, id: offeringId, tenantId, campusId: record.campusId, academicYearId: record.academicYearId, subjectPlanId: record.id, curriculumSubjectId: record.curriculumSubjectId, subjectComponentId: component.subjectComponentId, targetType: "SECTION", sectionId: section.id, requiredPeriodsPerWeek: component.plannedPeriodsPerWeek, requiredConsecutiveSlots: source.requiresConsecutivePeriods ? Math.max(2, component.preferredSessionLength) : 1, preferredSessionLength: component.preferredSessionLength, requiresConsecutivePeriods: source.requiresConsecutivePeriods, ...(component.maximumPeriodsPerDay ? { maximumPeriodsPerDay: component.maximumPeriodsPerDay } : {}), ...(component.preferredRoomTypeId ? { preferredRoomTypeId: component.preferredRoomTypeId } : {}), effectiveFrom: record.activatedAt ?? now, readinessStatus: "INCOMPLETE", status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 });
      }
    }
  }
  return view(record);
}
