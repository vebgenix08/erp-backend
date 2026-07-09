import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { getSessionUseCase, logoutUseCase, selectTenantUseCase } from "./use-cases";
import type { SessionServiceDeps } from "./session.service";
import { validateSelectTenantInput } from "./session.validator";

export function registerSessionRoutes(router: ApiRouter, deps: SessionServiceDeps = {}): ApiRouter {
  router.route("GET", "/session/me", async (context: RequestContext) => {
    const result = await getSessionUseCase(context, deps);
    return jsonResponse(200, result);
  });

  router.route("POST", "/session/select-tenant", async (context: RequestContext) => {
    const result = await selectTenantUseCase(validateSelectTenantInput(context.body), context, deps);
    return jsonResponse(200, result);
  });

  router.route("POST", "/session/logout", async (context: RequestContext) => {
    const result = await logoutUseCase(context);
    return jsonResponse(200, result);
  });

  return router;
}
