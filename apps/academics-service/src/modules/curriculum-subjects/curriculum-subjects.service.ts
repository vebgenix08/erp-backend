import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { toCurriculumSubjectView } from "./curriculum-subjects.mapper";
import { curriculumSubjectPermissions } from "./curriculum-subjects.permissions";
import { curriculumSubjectRepository, type CurriculumSubjectRepository } from "./curriculum-subjects.repository";
import { validateCurriculumSubjectCreate, validateCurriculumSubjectFilter, validateCurriculumSubjectUpdate } from "./curriculum-subjects.validator";
import type { SubjectCatalogueRepository } from "../subject-catalogue/subject-catalogue.repository";

import { subjectCatalogueRepository } from "../subject-catalogue/subject-catalogue.repository";
export interface CurriculumSubjectDependencies { repository?: CurriculumSubjectRepository; catalogueRepository?: SubjectCatalogueRepository }
const tenant = (ctx: RequestContext) => { const value = ctx.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (ctx: RequestContext) => { const value = ctx.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (ctx: RequestContext, permission: Permission) => { if (!ctx.authContext?.user?.permissions.includes(permission)) throw new ForbiddenError(`permission ${permission} is required`); };
const repositories = async (deps?: CurriculumSubjectDependencies) => ({
  repository: deps?.repository ?? await curriculumSubjectRepository(),
  catalogueRepository: deps?.catalogueRepository ?? subjectCatalogueRepository,
});

export async function listCurriculumSubjects(ctx: RequestContext, filter: unknown, deps?: CurriculumSubjectDependencies) {
  permit(ctx, curriculumSubjectPermissions.read); const { repository } = await repositories(deps);
  return (await repository.list(tenant(ctx), validateCurriculumSubjectFilter(filter))).map(toCurriculumSubjectView);
}
export async function createCurriculumSubject(input: unknown, ctx: RequestContext, deps?: CurriculumSubjectDependencies) {
  permit(ctx, curriculumSubjectPermissions.create); const tenantId = tenant(ctx), validated = validateCurriculumSubjectCreate(input), { repository, catalogueRepository } = await repositories(deps);
  const catalogue = await catalogueRepository.get(tenantId, validated.subjectCatalogueId);
  if (!catalogue || catalogue.status !== "ACTIVE") throw new NotFoundError("active subject catalogue record was not found");
  return toCurriculumSubjectView(await repository.create(tenantId, actor(ctx), validated));
}
export async function updateCurriculumSubject(id: string, input: unknown, ctx: RequestContext, deps?: CurriculumSubjectDependencies) {
  permit(ctx, curriculumSubjectPermissions.update); const { repository } = await repositories(deps);
  const record = await repository.update(tenant(ctx), actor(ctx), id, validateCurriculumSubjectUpdate(input));
  if (!record) throw new NotFoundError("curriculum subject was not found"); return toCurriculumSubjectView(record);
}
export async function deactivateCurriculumSubject(id: string, reason: string, ctx: RequestContext, deps?: CurriculumSubjectDependencies) {
  permit(ctx, curriculumSubjectPermissions.deactivate); if (!reason.trim()) throw new BadRequestError("deactivation reason is required"); const { repository } = await repositories(deps);
  const record = await repository.deactivate(tenant(ctx), actor(ctx), id, reason.trim());
  if (!record) throw new NotFoundError("curriculum subject was not found"); return toCurriculumSubjectView(record);
}
