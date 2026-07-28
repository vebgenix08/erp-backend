import type { TenantContext } from "@school-erp/tenancy";
import type { PermissionServiceDeps } from "../permissions.service";
import { createPermission as createPermissionService } from "../permissions.service";

export async function createPermissionUseCase(
  context: TenantContext | undefined,
  input: Record<string, unknown>,
  deps?: PermissionServiceDeps,
) {
  return createPermissionService(context, input, deps);
}
