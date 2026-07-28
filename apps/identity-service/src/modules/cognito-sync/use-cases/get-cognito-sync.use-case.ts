import type { CognitoSyncServiceContext } from "../cognito-sync.model";
import type { CognitoSyncServiceDeps } from "../cognito-sync.service";
import { getCognitoSync } from "../cognito-sync.service";

export async function getCognitoSyncUseCase(id: string, context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps) {
  return getCognitoSync(id, context, deps);
}
