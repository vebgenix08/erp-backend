import type { TenantContext } from "@school-erp/tenancy";
import type { PermissionServiceDeps } from "../permissions.service";
import { getPermission as getPermissionService } from "../permissions.service";

export async function getPermissionUseCase(context: TenantContext | undefined, id: string, deps?: PermissionServiceDeps) {
  return getPermissionService(context, id, deps);
}
