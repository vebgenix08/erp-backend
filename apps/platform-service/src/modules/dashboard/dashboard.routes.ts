import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { getPlatformDashboardSummary } from "./dashboard.service";
import type { DashboardRepositoryDeps } from "./dashboard.repository";

export function registerDashboardRoutes(router: ApiRouter, deps: DashboardRepositoryDeps = {}): ApiRouter {
  router.route("GET", "/dashboard", async (context: RequestContext) => {
    return jsonResponse(200, await getPlatformDashboardSummary(context, deps));
  });
  return router;
}
