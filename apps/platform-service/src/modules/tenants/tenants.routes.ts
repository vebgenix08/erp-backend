import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { createTenantUseCase, deactivateTenantUseCase, getTenantUseCase, listTenantsUseCase, updateTenantUseCase } from "./use-cases";
import type { TenantServiceDeps } from "./tenants.service";

function tenantId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerTenantRoutes(router: ApiRouter, deps: TenantServiceDeps = {}): ApiRouter {
  router.route("GET", "/tenants", async (_context: RequestContext) => {
    const result = await listTenantsUseCase(_context, deps);
    return jsonResponse(200, result);
  });

  router.route("GET", "/tenants/:id", async (context: RequestContext) => {
    const result = await getTenantUseCase(tenantId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "tenant not found" });
  });

  router.route("POST", "/tenants", async (context: RequestContext) => {
    const result = await createTenantUseCase(context.body as Record<string, unknown>, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/tenants/:id", async (context: RequestContext) => {
    const result = await updateTenantUseCase(tenantId(context), context.body as Record<string, unknown>, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "tenant not found" });
  });

  router.route("POST", "/tenants/:id/deactivate", async (context: RequestContext) => {
    const result = await deactivateTenantUseCase(tenantId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "tenant not found" });
  });

  return router;
}
