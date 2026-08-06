import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { toSubjectCatalogueView } from "./subject-catalogue.mapper";
import { subjectCataloguePermissions } from "./subject-catalogue.permissions";
import { subjectCatalogueRepository, type SubjectCatalogueRepository } from "./subject-catalogue.repository";
import { validateSubjectCatalogueCreate, validateSubjectCatalogueFilter, validateSubjectCatalogueUpdate } from "./subject-catalogue.validator";

export interface SubjectCatalogueDependencies { repository?: SubjectCatalogueRepository | Promise<SubjectCatalogueRepository> }
const repo = async (deps?: SubjectCatalogueDependencies) => await (deps?.repository ?? subjectCatalogueRepository);
const tenant = (context: RequestContext) => { const value = context.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actor = (context: RequestContext) => { const value = context.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permit = (context: RequestContext, required: Permission) => { if (!context.authContext?.user?.permissions.includes(required)) throw new ForbiddenError(`permission ${required} is required`); };

export async function listSubjectCatalogue(context: RequestContext, filter?: unknown, deps?: SubjectCatalogueDependencies) {
  permit(context, subjectCataloguePermissions.read);
  return (await (await repo(deps)).list(tenant(context), validateSubjectCatalogueFilter(filter))).map(toSubjectCatalogueView);
}
export async function getSubjectCatalogue(id: string, context: RequestContext, deps?: SubjectCatalogueDependencies) {
  permit(context, subjectCataloguePermissions.read);
  const record = await (await repo(deps)).get(tenant(context), id.trim());
  if (!record) throw new NotFoundError("subject catalogue record was not found");
  return toSubjectCatalogueView(record);
}
export async function createSubjectCatalogue(input: unknown, context: RequestContext, deps?: SubjectCatalogueDependencies) {
  permit(context, subjectCataloguePermissions.create);
  return toSubjectCatalogueView(await (await repo(deps)).create(tenant(context), actor(context), validateSubjectCatalogueCreate(input)));
}
export async function updateSubjectCatalogue(id: string, input: unknown, context: RequestContext, deps?: SubjectCatalogueDependencies) {
  permit(context, subjectCataloguePermissions.update);
  const record = await (await repo(deps)).update(tenant(context), actor(context), id.trim(), validateSubjectCatalogueUpdate(input));
  if (!record) throw new NotFoundError("subject catalogue record was not found");
  return toSubjectCatalogueView(record);
}
export async function deactivateSubjectCatalogue(id: string, reason: string, context: RequestContext, deps?: SubjectCatalogueDependencies) {
  permit(context, subjectCataloguePermissions.deactivate);
  if (!reason.trim()) throw new BadRequestError("deactivation reason is required");
  const record = await (await repo(deps)).deactivate(tenant(context), actor(context), id.trim(), reason.trim());
  if (!record) throw new NotFoundError("subject catalogue record was not found");
  return toSubjectCatalogueView(record);
}
