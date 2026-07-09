import { getPermission, listPermissions } from "./use-cases";

export async function handlePermissionsRoute(operation: string, args: Record<string, unknown>) {
  switch (operation) {
    case "identity.permissions.list":
      return listPermissions(args);
    case "identity.permissions.get":
      return getPermission(String(args.id ?? ""));
    default:
      return undefined;
  }
}
