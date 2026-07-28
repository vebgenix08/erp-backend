import {
  jsonResponse,
  type ApiRouter,
  type RequestContext,
} from "@school-erp/api";
import type { FeeConfigurationDependencies } from "./fee-configuration.shared";
import {
  createFeeHead,
  createFeeMapping,
  createFeeSchedule,
  createFeeStructure,
  listFeeConfiguration,
  setFeeConfigurationStatus,
} from "./fee-configuration.service";

export function registerFeeConfigurationRoutes(
  router: ApiRouter,
  deps: FeeConfigurationDependencies = {},
) {
  router.route("GET", "/fee-configuration", async (ctx: RequestContext) =>
    jsonResponse(200, await listFeeConfiguration(ctx.query, ctx, deps)),
  );
  router.route("POST", "/fee-heads", async (ctx: RequestContext) =>
    jsonResponse(201, await createFeeHead(ctx.body, ctx, deps)),
  );
  router.route("POST", "/fee-schedules", async (ctx: RequestContext) =>
    jsonResponse(201, await createFeeSchedule(ctx.body, ctx, deps)),
  );
  router.route("POST", "/fee-structures", async (ctx: RequestContext) =>
    jsonResponse(201, await createFeeStructure(ctx.body, ctx, deps)),
  );
  router.route("POST", "/fee-mappings", async (ctx: RequestContext) =>
    jsonResponse(201, await createFeeMapping(ctx.body, ctx, deps)),
  );
  router.route(
    "POST",
    "/fee-configuration/:entity/:id/status",
    async (ctx: RequestContext) =>
      jsonResponse(
        200,
        await setFeeConfigurationStatus(
          ctx.params.entity as
            | "fee-head"
            | "schedule"
            | "structure"
            | "mapping",
          ctx.params.id ?? "",
          (ctx.body as { status?: "ACTIVE" | "INACTIVE" } | undefined)
            ?.status ?? "INACTIVE",
          ctx,
          deps,
        ),
      ),
  );
  return router;
}
