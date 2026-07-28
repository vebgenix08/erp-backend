import type { InviteRecord, InviteView } from "./invites.model";

function toIso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toInviteView(record: InviteRecord | null): InviteView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    email: record.email,
    role: record.role,
    fullName: record.fullName,
    status: record.status,
    token: record.token,
    inviteUrl: record.inviteUrl,
    expiresAt: record.expiresAt.toISOString(),
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    sentAt: toIso(record.sentAt),
    acceptedAt: toIso(record.acceptedAt),
    revokedAt: toIso(record.revokedAt),
    deliveryStatus: record.deliveryStatus,
    deliveryMessageId: record.deliveryMessageId,
    deliveryError: record.deliveryError,
    lastSentAt: toIso(record.lastSentAt),
    resendCount: record.resendCount,
  };
}
