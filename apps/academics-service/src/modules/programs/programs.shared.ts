import type { RequestContext } from "@school-erp/api";
import { BadRequestError } from "@school-erp/errors";
import type { Permission } from "@school-erp/auth";
import { academicsPermissions } from "../../permissions";
import type { ProgramRepository } from "./programs.repository";
import { programRepository as defaultRepository } from "./programs.repository";

export interface ProgramServiceDeps {
  repository?: ProgramRepository | Promise<ProgramRepository>;
}

export async function resolveProgramRepository(deps?: ProgramServiceDeps): Promise<ProgramRepository> {
  return await (deps?.repository ?? defaultRepository);
}

export function requireTenantId(context: RequestContext): string {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) {
    throw new BadRequestError("tenantId is required");
  }
  return tenantId;
}

export function requireActorId(context: RequestContext): string {
  const userId = context.authContext?.user?.id?.trim();
  if (!userId) {
    throw new BadRequestError("authenticated user is required");
  }
  return userId;
}

export function requirePermission(context: RequestContext, permission: Permission): void {
  const permissions = context.authContext?.user?.permissions ?? [];
  if (!permissions.includes(permission)) {
    throw new BadRequestError("permission denied");
  }
}

export function requireProgramPermissions(context: RequestContext, permission: keyof typeof academicsPermissions.programs): void {
  requirePermission(context, academicsPermissions.programs[permission] as Permission);
}
