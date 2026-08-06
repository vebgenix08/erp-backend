import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { campusPermissions } from "../campuses/campuses.permissions";
import type { CampusSetupView } from "./campus-setup.model";
import { campusSetupRepository, type CampusSetupRepository } from "./campus-setup.repository";
import { validateCampusSetupCreateInput } from "./campus-setup.validator";

export interface CampusSetupServiceDeps { repository?: CampusSetupRepository }
export async function createCampusSetup(context: RequestContext, input: unknown, deps?: CampusSetupServiceDeps): Promise<CampusSetupView> {
  requireAuth(context.authContext);
  requirePermission(context.authContext, campusPermissions.create);
  const record = await (deps?.repository ?? campusSetupRepository).create(requireTenantId(context.tenantContext), validateCampusSetupCreateInput(input));
  return {
    campus: { ...record.campus, createdAt: record.campus.createdAt.toISOString(), updatedAt: record.campus.updatedAt.toISOString(), deactivatedAt: record.campus.deactivatedAt?.toISOString() },
    academicUnits: record.academicUnits.map((unit) => ({ ...unit, createdAt: unit.createdAt.toISOString(), updatedAt: unit.updatedAt.toISOString(), deactivatedAt: unit.deactivatedAt?.toISOString() })),
  };
}
