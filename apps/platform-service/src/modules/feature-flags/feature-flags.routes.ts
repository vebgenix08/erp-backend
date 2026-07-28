import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { createFeatureFlag, getFeatureFlag, listFeatureFlags, updateFeatureFlag, type FeatureFlagServiceDeps } from "./feature-flags.service";

function flagId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerFeatureFlagRoutes(router: ApiRouter, deps: FeatureFlagServiceDeps = {}): ApiRouter {
  router.route("GET", "/feature-flags", async (context: RequestContext) => jsonResponse(200, await listFeatureFlags(context, deps)));
  router.route("GET", "/feature-flags/:id", async (context: RequestContext) => {
    const result = await getFeatureFlag(flagId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "feature flag not found" });
  });
  router.route("POST", "/feature-flags", async (context: RequestContext) => jsonResponse(201, await createFeatureFlag(context.body, context, deps)));
  router.route("PUT", "/feature-flags/:id", async (context: RequestContext) => {
    const result = await updateFeatureFlag(flagId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "feature flag not found" });
  });
  return router;
}
