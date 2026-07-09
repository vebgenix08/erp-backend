import { permissionRepository } from "./permissions.repository";
import { toPermissionView } from "./permissions.mapper";
import { validatePermissionInput } from "./permissions.validator";

export async function listPermissions(input: Record<string, unknown> = {}) {
  void validatePermissionInput(input);
  return permissionRepository.list();
}

export async function getPermission(id: string) {
  return toPermissionView(await permissionRepository.getById(id));
}
