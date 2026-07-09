import {
  createUser as createUserService,
  deleteUser as deleteUserService,
  getUser as getUserService,
  listUsers as listUsersService,
  updateUser as updateUserService,
} from "../users.service";

export async function listUsers(input: Record<string, unknown> = {}) {
  return listUsersService(input);
}

export async function getUser(id: string) {
  return getUserService(id);
}

export async function createUser(input: Record<string, unknown>) {
  return createUserService(input);
}

export async function updateUser(id: string, input: Record<string, unknown>) {
  return updateUserService(id, input);
}

export async function deleteUser(id: string) {
  return deleteUserService(id);
}
