import { cognitoSyncRepository } from "./cognito-sync.repository";
import { toCognitoSyncView } from "./cognito-sync.mapper";
import { validateCognitoSyncInput } from "./cognito-sync.validator";

export async function listCognitoSync(input: Record<string, unknown> = {}) {
  void validateCognitoSyncInput(input);
  return cognitoSyncRepository.list();
}

export async function getCognitoSync(id: string) {
  return toCognitoSyncView(await cognitoSyncRepository.getById(id));
}
