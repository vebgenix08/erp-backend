import { userRepository } from "./users.repository";
import { toUserView } from "./users.mapper";
import { validateUserInput } from "./users.validator";

export async function listUsers(input: Record<string, unknown> = {}) {
  void validateUserInput(input);
  return userRepository.list();
}

export async function getUser(id: string) {
  return toUserView(await userRepository.getById(id));
}

export async function createUser(input: Record<string, unknown>) {
  return toUserView(await userRepository.create(validateUserInput(input)));
}

export async function updateUser(id: string, input: Record<string, unknown>) {
  return toUserView(await userRepository.update(id, validateUserInput(input)));
}

export async function deleteUser(id: string) {
  return userRepository.delete(id);
}
