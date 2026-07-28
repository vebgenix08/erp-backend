import type { RequestContext } from "@school-erp/api";
import { platformPermissions } from "../../permissions";
import { requirePlatformPermission } from "../../middleware";
import { toAuditLogView } from "./audit-logs.mapper";
import type { AuditLogFilter, AuditLogRepository } from "./audit-logs.repository";
import { createAuditLogRepository } from "./audit-logs.repository";
import type { TenantRepository } from "../tenants/tenants.repository";
import { createTenantRepository } from "../tenants/tenants.repository";

export interface AuditLogServiceDeps {
  repository?: AuditLogRepository | Promise<AuditLogRepository>;
  tenants?: TenantRepository | Promise<TenantRepository>;
}

async function resolveRepository(deps?: AuditLogServiceDeps): Promise<AuditLogRepository> {
  return await (deps?.repository ?? createAuditLogRepository());
}

export async function listAuditLogs(context: RequestContext, deps?: AuditLogServiceDeps, filter: AuditLogFilter = {}) {
  requirePlatformPermission(context, platformPermissions.auditLogs.read);
  const repository = await resolveRepository(deps);
  const records = await repository.list(filter);
  const tenantIds = new Set(records.map((record) => record.tenantId).filter((tenantId): tenantId is string => Boolean(tenantId)));
  if (!tenantIds.size) return records.map((record) => toAuditLogView(record));

  const tenants = await (deps?.tenants ?? createTenantRepository());
  const tenantNames = new Map(
    (await tenants.list())
      .filter((tenant) => tenantIds.has(tenant.id))
      .map((tenant) => [tenant.id, tenant.name]),
  );
  return records.map((record) => ({
    ...toAuditLogView(record),
    ...(record.tenantId && tenantNames.get(record.tenantId)
      ? { tenantName: tenantNames.get(record.tenantId) }
      : {}),
  }));
}

export async function appendAuditLog(input: {
  actorId?: string | undefined;
  tenantId?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}, deps?: AuditLogServiceDeps) {
  const repository = await resolveRepository(deps);
  return toAuditLogView(await repository.create(input));
}
