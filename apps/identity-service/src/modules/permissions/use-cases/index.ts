import { getPermission as getPermissionService, listPermissions as listPermissionsService } from "../permissions.service";

export async function listPermissions(input: Record<string, unknown> = {}) {
  return listPermissionsService(input);
}

export async function getPermission(id: string) {
  return getPermissionService(id);
}
