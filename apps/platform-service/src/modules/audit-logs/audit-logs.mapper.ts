import type { AuditLogRecord, AuditLogView } from "./audit-logs.model";

export function toAuditLogView(record: AuditLogRecord): AuditLogView {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
  };
}
