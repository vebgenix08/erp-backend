import type { RequestContext } from "@school-erp/api";
import type { InviteServiceDeps } from "../invites.service";
import { resendInvite } from "../invites.service";

export async function resendInviteUseCase(id: string, context: RequestContext, deps?: InviteServiceDeps) {
  if (!context.tenantContext || !context.authContext) {
    throw new Error("invite context is required");
  }
  return resendInvite(
    id,
    {
      requestId: context.requestId,
      tenantContext: context.tenantContext,
      authContext: context.authContext,
      baseUrl: context.headers["x-app-base-url"] as string | undefined,
    },
    deps,
  );
}
