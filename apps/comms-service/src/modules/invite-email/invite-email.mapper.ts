import type { InviteEmailRecord, InviteEmailView } from "./invite-email.model";

function toIso(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

export function toInviteEmailView(record: InviteEmailRecord | null): InviteEmailView | null {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    inviteId: record.inviteId,
    email: record.email,
    role: record.role,
    inviteUrl: record.inviteUrl,
    subject: record.subject,
    text: record.text,
    html: record.html,
    status: record.status,
    messageId: record.messageId,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    sentAt: toIso(record.sentAt),
    errorMessage: record.errorMessage,
  };
}
