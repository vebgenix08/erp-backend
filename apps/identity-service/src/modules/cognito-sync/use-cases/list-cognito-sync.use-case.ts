import type { CognitoSyncServiceContext } from "../cognito-sync.model";
import type { CognitoSyncServiceDeps } from "../cognito-sync.service";
import { listCognitoSync } from "../cognito-sync.service";

export async function listCognitoSyncUseCase(context: CognitoSyncServiceContext, deps?: CognitoSyncServiceDeps, filter?: unknown) {
  return listCognitoSync(context, deps, filter);
}
