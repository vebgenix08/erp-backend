import {
  createInvite as createInviteService,
  deleteInvite as deleteInviteService,
  getInvite as getInviteService,
  listInvites as listInvitesService,
} from "../invites.service";

export async function listInvites(input: Record<string, unknown> = {}) {
  return listInvitesService(input);
}

export async function getInvite(id: string) {
  return getInviteService(id);
}

export async function createInvite(input: Record<string, unknown>) {
  return createInviteService(input);
}

export async function deleteInvite(id: string) {
  return deleteInviteService(id);
}
