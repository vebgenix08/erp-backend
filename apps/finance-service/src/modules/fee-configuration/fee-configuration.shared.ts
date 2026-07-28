import type { Permission } from "@school-erp/auth";
import type { RequestContext } from "@school-erp/api";
import { ForbiddenError, UnauthorizedError } from "@school-erp/errors";
import type { FeeConfigurationRepository } from "./fee-configuration.repository";
import { feeConfigurationRepository } from "./fee-configuration.repository";

export interface FeeConfigurationDependencies {
  repository?: FeeConfigurationRepository | Promise<FeeConfigurationRepository>;
}
export const repository = async (deps?: FeeConfigurationDependencies) =>
  await (deps?.repository ?? feeConfigurationRepository());
export function tenantId(context: RequestContext) {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new UnauthorizedError("tenant context is required");
  return value;
}
export function actorId(context: RequestContext) {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new UnauthorizedError("authenticated user is required");
  return value;
}
export function permission(context: RequestContext, required: Permission) {
  if (!(context.authContext?.user?.permissions ?? []).includes(required))
    throw new ForbiddenError(`permission ${required} is required`);
}
