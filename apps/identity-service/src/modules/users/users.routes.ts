import { createUser, deleteUser, getUser, listUsers, updateUser } from "./use-cases";

export async function handleUsersRoute(operation: string, args: Record<string, unknown>) {
  switch (operation) {
    case "identity.users.list":
      return listUsers(args);
    case "identity.users.get":
      return getUser(String(args.id ?? ""));
    case "identity.users.create":
      return createUser(args);
    case "identity.users.update":
      return updateUser(String(args.id ?? ""), args);
    case "identity.users.delete":
      return deleteUser(String(args.id ?? ""));
    default:
      return undefined;
  }
}
