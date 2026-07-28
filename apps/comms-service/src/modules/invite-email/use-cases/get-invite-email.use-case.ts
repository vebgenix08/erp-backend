import type { RequestContext } from "@school-erp/api";
import type { InviteEmailServiceDeps } from "../invite-email.service";
import { getInviteEmail } from "../invite-email.service";

export async function getInviteEmailUseCase(id: string, context: RequestContext, deps?: InviteEmailServiceDeps) {
  return getInviteEmail(
    id,
    {
      requestId: context.requestId,
      tenantContext: context.tenantContext!,
      authContext: context.authContext!,
    },
    deps,
  );
}
