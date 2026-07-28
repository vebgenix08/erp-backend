import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import { getFinanceDashboard } from "./finance-dashboard.service";
export function registerFinanceDashboardRoutes(router: ApiRouter) {
  router.route("GET", "/dashboard", async (context: RequestContext) =>
    jsonResponse(200, await getFinanceDashboard(context.query, context)),
  );
  return router;
}
