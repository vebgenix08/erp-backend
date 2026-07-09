import { getCognitoSync, listCognitoSync } from "./use-cases";

export async function handleCognitoSyncRoute(operation: string, args: Record<string, unknown>) {
  switch (operation) {
    case "identity.cognito-sync.list":
      return listCognitoSync(args);
    case "identity.cognito-sync.get":
      return getCognitoSync(String(args.id ?? ""));
    default:
      return undefined;
  }
}
