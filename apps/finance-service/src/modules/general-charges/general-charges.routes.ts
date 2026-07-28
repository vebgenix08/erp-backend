import { jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import { createGeneralCharge, listGeneralCharges, type GeneralChargeDependencies } from "./general-charges.service";

export function registerGeneralChargeRoutes(router: ApiRouter, deps?: GeneralChargeDependencies) {
  router.route("GET", "/general-charges", async (context: RequestContext) => jsonResponse(200, await listGeneralCharges(context.query, context, deps)));
  router.route("POST", "/general-charges", async (context: RequestContext) => jsonResponse(201, await createGeneralCharge(context.body, context, deps)));
  return router;
}
