import { createRole, deleteRole, getRole, listRoles, updateRole } from "./use-cases";

export async function handleRolesRoute(operation: string, args: Record<string, unknown>) {
  switch (operation) {
    case "identity.roles.list":
      return listRoles(args);
    case "identity.roles.get":
      return getRole(String(args.id ?? ""));
    case "identity.roles.create":
      return createRole(args);
    case "identity.roles.update":
      return updateRole(String(args.id ?? ""), args);
    case "identity.roles.delete":
      return deleteRole(String(args.id ?? ""));
    default:
      return undefined;
  }
}
