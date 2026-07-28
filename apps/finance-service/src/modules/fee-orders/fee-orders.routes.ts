import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import { getFeeOrder, listFeeOrders } from "./fee-orders.service";

export function registerFeeOrderRoutes(router: ApiRouter) {
  router.route("GET", "/fee-orders", async (context: RequestContext) =>
    jsonResponse(200, await listFeeOrders(context.query, context)),
  );
  router.route("GET", "/fee-orders/:id", async (context: RequestContext) =>
    jsonResponse(200, await getFeeOrder(context.params.id ?? "", context)),
  );
  return router;
}
