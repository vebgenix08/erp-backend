import type { CognitoSyncServiceContext } from "../cognito-sync.model";
import type { CognitoSyncServiceDeps } from "../cognito-sync.service";
import { deleteCognitoSync } from "../cognito-sync.service";

export async function deleteCognitoSyncUseCase(id: string, context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps) {
  return deleteCognitoSync(id, context, deps);
}
