import type { CognitoSyncServiceContext } from "../cognito-sync.model";
import type { CognitoSyncServiceDeps } from "../cognito-sync.service";
import { createCognitoSync } from "../cognito-sync.service";

export async function createCognitoSyncUseCase(input: unknown, context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps) {
  return createCognitoSync(input, context, deps);
}
