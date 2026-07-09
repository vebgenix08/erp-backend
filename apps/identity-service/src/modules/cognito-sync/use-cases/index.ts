import { getCognitoSync as getCognitoSyncService, listCognitoSync as listCognitoSyncService } from "../cognito-sync.service";

export async function listCognitoSync(input: Record<string, unknown> = {}) {
  return listCognitoSyncService(input);
}

export async function getCognitoSync(id: string) {
  return getCognitoSyncService(id);
}
