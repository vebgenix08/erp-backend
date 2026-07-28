import type { RequestContext } from "@school-erp/api";
import { BadRequestError } from "@school-erp/errors";
import type { Permission } from "@school-erp/auth";
import { academicsPermissions } from "../../permissions";
import type { SectionRepository } from "./sections.repository";
import { sectionRepository as defaultRepository } from "./sections.repository";
import type { AcademicHierarchyRepositories } from "../academic-hierarchy.policy";

export interface SectionServiceDeps extends AcademicHierarchyRepositories {
  repository?: SectionRepository | Promise<SectionRepository>;
}

export async function resolveSectionRepository(deps?: SectionServiceDeps): Promise<SectionRepository> {
  return await (deps?.repository ?? defaultRepository);
}

export function requireSectionTenantId(context: RequestContext): string {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
}

export function requireSectionPermission(context: RequestContext, permission: Permission): void {
  const permissions = context.authContext?.user?.permissions ?? [];
  if (!permissions.includes(permission)) {
    throw new BadRequestError("permission denied");
  }
}

export function requireSectionPermissions(context: RequestContext, permission: keyof typeof academicsPermissions.sections): void {
  requireSectionPermission(context, academicsPermissions.sections[permission] as Permission);
}
