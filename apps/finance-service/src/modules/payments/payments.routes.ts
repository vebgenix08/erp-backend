import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import type { PaymentDependencies } from "./payments.shared";
import { collectPayment, getReceipt, listPayments } from "./payments.service";

export function registerPaymentRoutes(
  router: ApiRouter,
  deps: PaymentDependencies = {},
) {
  router.route("GET", "/payments", async (context: RequestContext) =>
    jsonResponse(200, await listPayments(context.query, context, deps)),
  );
  router.route("POST", "/payments", async (context: RequestContext) =>
    jsonResponse(201, await collectPayment(context.body, context, deps)),
  );
  router.route("GET", "/receipts/:paymentId", async (context: RequestContext) =>
    jsonResponse(
      200,
      await getReceipt(context.params.paymentId ?? "", context, deps),
    ),
  );
  return router;
}
