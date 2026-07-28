import type { ApiRouter } from "@school-erp/api";
import { registerAuditLogRoutes } from "../modules/audit-logs/audit-logs.routes";
import { registerBootstrapRoutes } from "../modules/bootstrap/bootstrap.routes";
import { registerDashboardRoutes } from "../modules/dashboard/dashboard.routes";
import { registerFeatureFlagRoutes } from "../modules/feature-flags/feature-flags.routes";

export function registerPlatformRoutes(router: ApiRouter): ApiRouter {
  registerBootstrapRoutes(router);
  registerDashboardRoutes(router);
  registerFeatureFlagRoutes(router);
  registerAuditLogRoutes(router);
  return router;
}
