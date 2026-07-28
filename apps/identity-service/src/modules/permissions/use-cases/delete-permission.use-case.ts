import type { TenantContext } from "@school-erp/tenancy";
import type { PermissionServiceDeps } from "../permissions.service";
import { deletePermission as deletePermissionService } from "../permissions.service";

export async function deletePermissionUseCase(context: TenantContext | undefined, id: string, deps?: PermissionServiceDeps) {
  return deletePermissionService(context, id, deps);
}
