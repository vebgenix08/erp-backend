import type { RequestContext } from "@school-erp/api";
import { BadRequestError } from "@school-erp/errors";
import type { Permission } from "@school-erp/auth";
import { academicsPermissions } from "../../permissions";
import type { ClassRepository } from "./classes.repository";
import { classRepository as defaultRepository } from "./classes.repository";
import type { AcademicHierarchyRepositories } from "../academic-hierarchy.policy";

export interface ClassServiceDeps extends AcademicHierarchyRepositories {
  repository?: ClassRepository | Promise<ClassRepository>;
}

export async function resolveClassRepository(deps?: ClassServiceDeps): Promise<ClassRepository> {
  return await (deps?.repository ?? defaultRepository);
}

export function requireClassTenantId(context: RequestContext): string {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) {
    throw new BadRequestError("tenantId is required");
  }
  return tenantId;
}

export function requireClassPermission(context: RequestContext, permission: Permission): void {
  const permissions = context.authContext?.user?.permissions ?? [];
  if (!permissions.includes(permission)) {
    throw new BadRequestError("permission denied");
  }
}

export function requireClassPermissions(context: RequestContext, permission: keyof typeof academicsPermissions.classes): void {
  requireClassPermission(context, academicsPermissions.classes[permission] as Permission);
}
