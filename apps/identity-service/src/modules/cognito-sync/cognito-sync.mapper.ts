import type { CognitoSyncRecord } from "./cognito-sync.model";

export function toCognitoSyncView(record: CognitoSyncRecord | null) {
  return record ? { ...record } : null;
}
