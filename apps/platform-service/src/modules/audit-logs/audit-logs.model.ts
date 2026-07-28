export interface AuditLogRecord {
  id: string;
  actorId?: string | undefined;
  tenantId?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  createdAt: Date;
}

export interface AuditLogCreateInput {
  actorId?: string | undefined;
  tenantId?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface AuditLogView {
  id: string;
  actorId?: string | undefined;
  tenantId?: string | undefined;
  tenantName?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  details?: Record<string, unknown> | undefined;
  createdAt: string;
}
