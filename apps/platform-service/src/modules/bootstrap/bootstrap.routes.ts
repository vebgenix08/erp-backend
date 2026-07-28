import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { FirstAdminBootstrapServiceDeps } from "./bootstrap.service";
import { completeFirstAdminBootstrap, createFirstAdminBootstrap, getFirstAdminBootstrap } from "./bootstrap.service";

function tenantId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerBootstrapRoutes(router: ApiRouter, deps: FirstAdminBootstrapServiceDeps = {}): ApiRouter {
  router.route("GET", "/tenants/:id/onboarding/first-admin", async (context: RequestContext) => {
    const result = await getFirstAdminBootstrap(tenantId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "bootstrap not found" });
  });

  router.route("POST", "/tenants/:id/onboarding/first-admin", async (context: RequestContext) => {
    const body = context.body && typeof context.body === "object" && !Array.isArray(context.body) ? (context.body as Record<string, unknown>) : {};
    const result = await createFirstAdminBootstrap(
      { ...body, tenantId: tenantId(context) },
      context,
      deps,
    );
    return jsonResponse(201, result);
  });

  router.route("POST", "/tenants/:id/onboarding/first-admin/complete", async (context: RequestContext) => {
    const result = await completeFirstAdminBootstrap(tenantId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "bootstrap not found" });
  });

  return router;
}
