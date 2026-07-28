import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { InviteEmailServiceDeps } from "./invite-email.service";
import { listInviteEmails, getInviteEmail, sendInviteEmail } from "./invite-email.service";
import { validateInviteEmailListFilter } from "./invite-email.validator";

function recordId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerInviteEmailRoutes(router: ApiRouter, deps: InviteEmailServiceDeps = {}): ApiRouter {
  router.route("POST", "/invite-emails", async (context: RequestContext) => {
    const result = await sendInviteEmail(context.body, {
      requestId: context.requestId,
      tenantContext: context.tenantContext!,
      authContext: context.authContext!,
    }, deps);
    return jsonResponse(201, result);
  });

  router.route("GET", "/invite-emails", async (context: RequestContext) => {
    const result = await listInviteEmails(
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
      validateInviteEmailListFilter(context.query),
    );
    return jsonResponse(200, result);
  });

  router.route("GET", "/invite-emails/:id", async (context: RequestContext) => {
    const result = await getInviteEmail(
      recordId(context),
      {
        requestId: context.requestId,
        tenantContext: context.tenantContext!,
        authContext: context.authContext!,
      },
      deps,
    );
    return jsonResponse(result ? 200 : 404, result ?? { message: "invite email not found" });
  });

  return router;
}
