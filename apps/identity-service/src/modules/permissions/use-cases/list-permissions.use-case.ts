import type { TenantContext } from "@school-erp/tenancy";
import type { PermissionServiceDeps } from "../permissions.service";
import { listPermissions as listPermissionsService } from "../permissions.service";

export async function listPermissionsUseCase(context: TenantContext | undefined, deps?: PermissionServiceDeps) {
  return listPermissionsService(context, deps);
}
