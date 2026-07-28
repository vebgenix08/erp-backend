import type { FirstAdminBootstrapRecord, FirstAdminBootstrapView } from "./bootstrap.model";

function iso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toFirstAdminBootstrapView(record: FirstAdminBootstrapRecord | null): FirstAdminBootstrapView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    adminName: record.adminName,
    adminEmail: record.adminEmail,
    adminPhone: record.adminPhone,
    roleCode: record.roleCode,
    status: record.status,
    inviteId: record.inviteId,
    inviteError: record.inviteError,
    inviteAttempts: record.inviteAttempts,
    lastInviteAttemptAt: record.lastInviteAttemptAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    invitedAt: iso(record.invitedAt),
    completedAt: iso(record.completedAt),
  };
}
