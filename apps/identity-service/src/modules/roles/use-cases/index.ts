import {
  createRole as createRoleService,
  deleteRole as deleteRoleService,
  getRole as getRoleService,
  listRoles as listRolesService,
  updateRole as updateRoleService,
} from "../roles.service";

export async function listRoles(input: Record<string, unknown> = {}) {
  return listRolesService(input);
}

export async function getRole(id: string) {
  return getRoleService(id);
}

export async function createRole(input: Record<string, unknown>) {
  return createRoleService(input);
}

export async function updateRole(id: string, input: Record<string, unknown>) {
  return updateRoleService(id, input);
}

export async function deleteRole(id: string) {
  return deleteRoleService(id);
}
