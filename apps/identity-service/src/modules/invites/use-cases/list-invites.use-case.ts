import type { RequestContext } from "@school-erp/api";
import type { InviteListFilter } from "../invites.model";
import type { InviteServiceDeps } from "../invites.service";
import { listInvites } from "../invites.service";

export async function listInvitesUseCase(context: RequestContext, deps?: InviteServiceDeps, filter?: InviteListFilter) {
  if (!context.tenantContext || !context.authContext) {
    throw new Error("invite context is required");
  }
  return listInvites(
    {
      requestId: context.requestId,
      tenantContext: context.tenantContext,
      authContext: context.authContext,
      baseUrl: context.headers["x-app-base-url"] as string | undefined,
    },
    deps,
    filter,
  );
}
