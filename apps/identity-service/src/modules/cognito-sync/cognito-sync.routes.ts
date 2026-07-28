import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { CognitoSyncServiceDeps } from "./cognito-sync.service";
import { createCognitoSync, deleteCognitoSync, getCognitoSync, listCognitoSync, updateCognitoSync } from "./cognito-sync.service";
import { validateCognitoSyncListFilter } from "./cognito-sync.validator";

function recordId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerCognitoSyncRoutes(router: ApiRouter, deps: CognitoSyncServiceDeps = {}): ApiRouter {
  router.route("GET", "/cognito-sync", async (context: RequestContext) => {
    const result = await listCognitoSync(
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
      validateCognitoSyncListFilter(context.query),
    );
    return jsonResponse(200, result);
  });

  router.route("GET", "/cognito-sync/:id", async (context: RequestContext) => {
    const result = await getCognitoSync(
      recordId(context),
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
    );
    return jsonResponse(result ? 200 : 404, result ?? { message: "cognito sync not found" });
  });

  router.route("POST", "/cognito-sync", async (context: RequestContext) => {
    const result = await createCognitoSync(
      context.body,
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
    );
    return jsonResponse(201, result);
  });

  router.route("PUT", "/cognito-sync/:id", async (context: RequestContext) => {
    const result = await updateCognitoSync(
      recordId(context),
      context.body,
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
    );
    return jsonResponse(result ? 200 : 404, result ?? { message: "cognito sync not found" });
  });

  router.route("DELETE", "/cognito-sync/:id", async (context: RequestContext) => {
    const result = await deleteCognitoSync(
      recordId(context),
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
    );
    return jsonResponse(result ? 204 : 404, result ? undefined : { message: "cognito sync not found" });
  });

  return router;
}
