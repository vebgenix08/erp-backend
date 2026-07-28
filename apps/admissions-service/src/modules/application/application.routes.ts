import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import type { ApplicationServiceDeps } from "./application.service";
import {
  approveApplicationUseCase,
  cancelApplicationUseCase,
  createApplicationUseCase,
  getApplicationUseCase,
  listApplicationsUseCase,
  rejectApplicationUseCase,
  submitApplicationUseCase,
  updateApplicationUseCase,
} from "./use-cases";
function context(value: RequestContext) {
  return {
    tenantContext: value.tenantContext!,
    authContext: value.authContext!,
    requestId: value.requestId,
  };
}
function id(value: RequestContext) {
  return value.params.id ?? "";
}
export function createApplicationRouter(
  router: ApiRouter,
  deps: ApplicationServiceDeps = {},
) {
  router.route("GET", "/applications", async (ctx) =>
    jsonResponse(
      200,
      await listApplicationsUseCase(context(ctx), deps, ctx.query),
    ),
  );
  router.route("GET", "/applications/:id", async (ctx) =>
    jsonResponse(200, await getApplicationUseCase(id(ctx), context(ctx), deps)),
  );
  router.route("POST", "/applications", async (ctx) =>
    jsonResponse(
      201,
      await createApplicationUseCase(ctx.body, context(ctx), deps),
    ),
  );
  router.route("PUT", "/applications/:id", async (ctx) =>
    jsonResponse(
      200,
      await updateApplicationUseCase(id(ctx), ctx.body, context(ctx), deps),
    ),
  );
  router.route("POST", "/applications/:id/submit", async (ctx) =>
    jsonResponse(
      200,
      await submitApplicationUseCase(id(ctx), context(ctx), deps),
    ),
  );
  router.route("POST", "/applications/:id/approve", async (ctx) =>
    jsonResponse(
      200,
      await approveApplicationUseCase(id(ctx), ctx.body, context(ctx), deps),
    ),
  );
  router.route("POST", "/applications/:id/reject", async (ctx) =>
    jsonResponse(
      200,
      await rejectApplicationUseCase(id(ctx), ctx.body, context(ctx), deps),
    ),
  );
  router.route("POST", "/applications/:id/cancel", async (ctx) =>
    jsonResponse(
      200,
      await cancelApplicationUseCase(id(ctx), ctx.body, context(ctx), deps),
    ),
  );
  return router;
}
