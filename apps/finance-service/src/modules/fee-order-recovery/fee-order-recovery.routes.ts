import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import {
  listFeeOrderRecoveries,
  retryFeeOrderRecovery,
  type FeeOrderRecoveryDependencies,
} from "./fee-order-recovery.service";
export function registerFeeOrderRecoveryRoutes(
  router: ApiRouter,
  deps: FeeOrderRecoveryDependencies = {},
) {
  router.route(
    "GET",
    "/fee-order-recoveries",
    async (context: RequestContext) =>
      jsonResponse(
        200,
        await listFeeOrderRecoveries(context.query, context, deps),
      ),
  );
  router.route(
    "POST",
    "/fee-order-recoveries/:id/retry",
    async (context: RequestContext) =>
      jsonResponse(
        200,
        await retryFeeOrderRecovery(context.params.id ?? "", context, deps),
      ),
  );
  return router;
}
