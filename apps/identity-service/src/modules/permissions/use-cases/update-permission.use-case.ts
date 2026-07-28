import type { TenantContext } from "@school-erp/tenancy";
import type { PermissionServiceDeps } from "../permissions.service";
import { updatePermission as updatePermissionService } from "../permissions.service";

export async function updatePermissionUseCase(
  context: TenantContext | undefined,
  id: string,
  input: Record<string, unknown>,
  deps?: PermissionServiceDeps,
) {
  return updatePermissionService(context, id, input, deps);
}
