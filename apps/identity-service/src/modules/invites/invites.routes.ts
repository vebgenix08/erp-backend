import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { InviteServiceDeps } from "./invites.service";
import { validateInviteListFilter } from "./invites.validator";
import { createInviteUseCase, getInviteUseCase, listInvitesUseCase, resendInviteUseCase, revokeInviteUseCase, updateInviteUseCase } from "./use-cases";

function inviteId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerInviteRoutes(router: ApiRouter, deps: InviteServiceDeps = {}): ApiRouter {
  router.route("GET", "/invites", async (context: RequestContext) => {
    const result = await listInvitesUseCase(context, deps, validateInviteListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/invites/:id", async (context: RequestContext) => {
    const result = await getInviteUseCase(inviteId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "invite not found" });
  });

  router.route("POST", "/invites", async (context: RequestContext) => {
    const result = await createInviteUseCase(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/invites/:id", async (context: RequestContext) => {
    const result = await updateInviteUseCase(inviteId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "invite not found" });
  });

  router.route("POST", "/invites/:id/resend", async (context: RequestContext) => {
    const result = await resendInviteUseCase(inviteId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "invite not found" });
  });

  router.route("POST", "/invites/:id/revoke", async (context: RequestContext) => {
    const result = await revokeInviteUseCase(inviteId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "invite not found" });
  });

  return router;
}
