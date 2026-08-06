import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { NotFoundError } from "@school-erp/errors";
import { requireTenantId } from "@school-erp/tenancy";
import { campusRepository, type CampusRepository } from "../campuses/campuses.repository";
import type { CampusAcademicUnitView } from "./campus-academic-units.model";
import { campusAcademicUnitRepository, type CampusAcademicUnitRepository } from "./campus-academic-units.repository";
import { validateAcademicUnitCreateInput, validateAcademicUnitListFilter, validateAcademicUnitUpdateInput } from "./campus-academic-units.validator";

export const campusAcademicUnitPermissions = {
  read: "settings.academic-units.read",
  create: "settings.academic-units.create",
  update: "settings.academic-units.update",
} as const;
export interface CampusAcademicUnitServiceDeps {
  repository?: CampusAcademicUnitRepository;
  campuses?: CampusRepository;
}
const tenant = (context: RequestContext) => requireTenantId(context.tenantContext);
const ensure = (context: RequestContext, permission: string) => { requireAuth(context.authContext); requirePermission(context.authContext, permission); };
const view = (record: Awaited<ReturnType<CampusAcademicUnitRepository["create"]>>): CampusAcademicUnitView => ({
  ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), deactivatedAt: record.deactivatedAt?.toISOString(),
});
export async function listCampusAcademicUnits(context: RequestContext, filter?: unknown, deps?: CampusAcademicUnitServiceDeps) {
  ensure(context, campusAcademicUnitPermissions.read);
  return (await (deps?.repository ?? campusAcademicUnitRepository).list(tenant(context), validateAcademicUnitListFilter(filter))).map(view);
}
export async function createCampusAcademicUnit(context: RequestContext, campusId: string, input: unknown, deps?: CampusAcademicUnitServiceDeps) {
  ensure(context, campusAcademicUnitPermissions.create); const tenantId = tenant(context);
  const campus = await (deps?.campuses ?? campusRepository).getById(tenantId, campusId);
  if (!campus) throw new NotFoundError("campus not found");
  return view(await (deps?.repository ?? campusAcademicUnitRepository).create(tenantId, campusId, validateAcademicUnitCreateInput(input)));
}
export async function updateCampusAcademicUnit(context: RequestContext, id: string, input: unknown, deps?: CampusAcademicUnitServiceDeps) {
  ensure(context, campusAcademicUnitPermissions.update);
  const record = await (deps?.repository ?? campusAcademicUnitRepository).update(tenant(context), id, validateAcademicUnitUpdateInput(input));
  return record ? view(record) : null;
}
