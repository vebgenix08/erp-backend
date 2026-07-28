import type { CognitoSyncServiceContext } from "../cognito-sync.model";
import type { CognitoSyncServiceDeps } from "../cognito-sync.service";
import { updateCognitoSync } from "../cognito-sync.service";

export async function updateCognitoSyncUseCase(id: string, input: unknown, context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps) {
  return updateCognitoSync(id, input, context, deps);
}
