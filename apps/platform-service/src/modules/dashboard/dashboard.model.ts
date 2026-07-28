export interface PlatformDashboardSummary {
  tenantCount: number;
  activeTenantCount: number;
  suspendedTenantCount: number;
  bootstrapCount: number;
  activeFeatureFlagCount: number;
  auditLogCount: number;
  onboardingTenantCount: number;
  deletionPendingTenantCount: number;
  failedBootstrapCount: number;
  pendingBootstrapCount: number;
}
