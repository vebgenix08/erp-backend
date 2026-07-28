import type { TenantRepository } from "../tenants/tenants.repository";
import { createTenantRepository } from "../tenants/tenants.repository";
import type { FeatureFlagRepository } from "../feature-flags/feature-flags.repository";
import { featureFlagRepository as defaultFeatureFlagRepository } from "../feature-flags/feature-flags.repository";
import type { AuditLogRepository } from "../audit-logs/audit-logs.repository";
import { auditLogRepository as defaultAuditLogRepository } from "../audit-logs/audit-logs.repository";
import type { FirstAdminBootstrapRepository } from "../bootstrap/bootstrap.repository";
import { firstAdminBootstrapRepository as defaultBootstrapRepository } from "../bootstrap/bootstrap.repository";
import type { PlatformDashboardSummary } from "./dashboard.model";

export interface DashboardRepositoryDeps {
  tenants?: TenantRepository | Promise<TenantRepository>;
  featureFlags?: FeatureFlagRepository | Promise<FeatureFlagRepository>;
  auditLogs?: AuditLogRepository | Promise<AuditLogRepository>;
  bootstraps?: FirstAdminBootstrapRepository | Promise<FirstAdminBootstrapRepository>;
}

export class DashboardRepository {
  constructor(private readonly deps: DashboardRepositoryDeps = {}) {}

  async getSummary(): Promise<PlatformDashboardSummary> {
    const tenants = await (this.deps.tenants ?? createTenantRepository());
    const featureFlags = await (this.deps.featureFlags ?? defaultFeatureFlagRepository);
    const auditLogs = await (this.deps.auditLogs ?? defaultAuditLogRepository);
    const bootstraps = await (this.deps.bootstraps ?? defaultBootstrapRepository);
    const tenantRecords = await tenants.list();
    const featureFlagRecords = await featureFlags.list();
    const auditLogRecords = await auditLogs.list();
    const bootstrapRecords = await bootstraps.list();
    return {
      tenantCount: tenantRecords.length,
      activeTenantCount: tenantRecords.filter((record) => record.status === "ACTIVE").length,
      suspendedTenantCount: tenantRecords.filter((record) => record.status === "SUSPENDED").length,
      bootstrapCount: bootstrapRecords.length,
      activeFeatureFlagCount: featureFlagRecords.filter((record) => record.isEnabled).length,
      auditLogCount: auditLogRecords.length,
      onboardingTenantCount: tenantRecords.filter((record) => record.status === "ONBOARDING").length,
      deletionPendingTenantCount: tenantRecords.filter((record) => Boolean(record.deletionRequestedAt) && !record.deletedAt).length,
      failedBootstrapCount: bootstrapRecords.filter((record) => record.status === "FAILED").length,
      pendingBootstrapCount: bootstrapRecords.filter((record) => record.status === "PENDING" || record.status === "INVITED").length,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
