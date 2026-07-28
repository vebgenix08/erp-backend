import type { RequestContext } from "@school-erp/api";
import { BadRequestError } from "@school-erp/errors";
import type { Permission } from "@school-erp/auth";
import { academicsPermissions } from "../../permissions";
import type { SubjectRepository } from "./subjects.repository";
import { subjectRepository as defaultRepository } from "./subjects.repository";
import type { AcademicHierarchyRepositories } from "../academic-hierarchy.policy";

export interface SubjectServiceDeps extends AcademicHierarchyRepositories {
  repository?: SubjectRepository | Promise<SubjectRepository>;
}

export async function resolveSubjectRepository(deps?: SubjectServiceDeps): Promise<SubjectRepository> {
  return await (deps?.repository ?? defaultRepository);
}

export function requireSubjectTenantId(context: RequestContext): string {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
}

export function requireSubjectPermission(context: RequestContext, permission: Permission): void {
  const permissions = context.authContext?.user?.permissions ?? [];
  if (!permissions.includes(permission)) {
    throw new BadRequestError("permission denied");
  }
}

export function requireSubjectPermissions(context: RequestContext, permission: keyof typeof academicsPermissions.subjects): void {
  requireSubjectPermission(context, academicsPermissions.subjects[permission] as Permission);
}
