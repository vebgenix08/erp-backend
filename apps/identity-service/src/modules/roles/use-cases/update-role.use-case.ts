import type { TenantContext } from "@school-erp/tenancy";
import type { RoleServiceDeps } from "../roles.service";
import { updateRole as updateRoleService } from "../roles.service";

export async function updateRoleUseCase(
  context: TenantContext | undefined,
  id: string,
  input: Record<string, unknown>,
  deps?: RoleServiceDeps,
) {
  return updateRoleService(context, id, input, deps);
}
