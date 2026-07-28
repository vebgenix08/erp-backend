import type { CognitoSyncRecord, CognitoSyncView } from "./cognito-sync.model";

function toIso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toCognitoSyncView(record: CognitoSyncRecord | null): CognitoSyncView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    cognitoUsername: record.cognitoUsername,
    email: record.email,
    status: record.status,
    lastSyncedAt: toIso(record.lastSyncedAt),
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
