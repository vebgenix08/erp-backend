import type { TenantContext } from "@school-erp/tenancy";
import type { RoleServiceDeps } from "../roles.service";
import { createRole as createRoleService } from "../roles.service";

export async function createRoleUseCase(
  context: TenantContext | undefined,
  input: Record<string, unknown>,
  deps?: RoleServiceDeps,
) {
  return createRoleService(context, input, deps);
}
