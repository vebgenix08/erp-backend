import { createInvite, deleteInvite, getInvite, listInvites } from "./use-cases";

export async function handleInvitesRoute(operation: string, args: Record<string, unknown>) {
  switch (operation) {
    case "identity.invites.list":
      return listInvites(args);
    case "identity.invites.get":
      return getInvite(String(args.id ?? ""));
    case "identity.invites.create":
      return createInvite(args);
    case "identity.invites.delete":
      return deleteInvite(String(args.id ?? ""));
    default:
      return undefined;
  }
}
