import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import {
  createPaymentAdjustment,
  listPaymentAdjustments,
  type PaymentAdjustmentDependencies,
} from "./payment-adjustments.service";
export function registerPaymentAdjustmentRoutes(
  router: ApiRouter,
  deps: PaymentAdjustmentDependencies = {},
) {
  router.route("GET", "/payment-adjustments", async (context: RequestContext) =>
    jsonResponse(
      200,
      await listPaymentAdjustments(context.query, context, deps),
    ),
  );
  router.route(
    "POST",
    "/payment-adjustments",
    async (context: RequestContext) =>
      jsonResponse(
        201,
        await createPaymentAdjustment(context.body, context, deps),
      ),
  );
  return router;
}
