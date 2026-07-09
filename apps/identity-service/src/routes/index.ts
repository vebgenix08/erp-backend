import { createRouter, jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import { getSessionUseCase, logoutUseCase, selectTenantUseCase } from "../modules/session/use-cases";
import { validateSelectTenantInput } from "../modules/session/session.validator";

export function registerIdentityRoutes(router: ApiRouter): ApiRouter {
  router.route("GET", "/session/me", async (context: RequestContext) => {
    const result = await getSessionUseCase(context);
    return jsonResponse(200, result);
  });

  router.route("POST", "/session/select-tenant", async (context: RequestContext) => {
    const result = await selectTenantUseCase(validateSelectTenantInput(context.body), context);
    return jsonResponse(200, result);
  });

  router.route("POST", "/session/logout", async (context: RequestContext) => {
    const result = await logoutUseCase(context);
    return jsonResponse(200, result);
  });

  return router;
}

export function createIdentityRouter(): ApiRouter {
  const router = createRouter();
  registerIdentityRoutes(router);
  return router;
}

export const identityRouter = createIdentityRouter();
