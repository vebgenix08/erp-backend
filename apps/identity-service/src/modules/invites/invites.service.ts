import { inviteRepository } from "./invites.repository";
import { toInviteView } from "./invites.mapper";
import { validateInviteInput } from "./invites.validator";

export async function listInvites(input: Record<string, unknown> = {}) {
  void validateInviteInput(input);
  return inviteRepository.list();
}

export async function getInvite(id: string) {
  return toInviteView(await inviteRepository.getById(id));
}

export async function createInvite(input: Record<string, unknown>) {
  return toInviteView(await inviteRepository.create(validateInviteInput(input)));
}

export async function deleteInvite(id: string) {
  return inviteRepository.delete(id);
}
