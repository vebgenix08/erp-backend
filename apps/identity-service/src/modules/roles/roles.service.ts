import { roleRepository } from "./roles.repository";
import { toRoleView } from "./roles.mapper";
import { validateRoleInput } from "./roles.validator";

export async function listRoles(input: Record<string, unknown> = {}) {
  void validateRoleInput(input);
  return roleRepository.list();
}

export async function getRole(id: string) {
  return toRoleView(await roleRepository.getById(id));
}

export async function createRole(input: Record<string, unknown>) {
  return toRoleView(await roleRepository.create(validateRoleInput(input)));
}

export async function updateRole(id: string, input: Record<string, unknown>) {
  return toRoleView(await roleRepository.update(id, validateRoleInput(input)));
}

export async function deleteRole(id: string) {
  return roleRepository.delete(id);
}
