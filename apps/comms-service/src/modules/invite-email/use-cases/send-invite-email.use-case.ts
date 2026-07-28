import type { RequestContext } from "@school-erp/api";
import type { InviteEmailServiceDeps } from "../invite-email.service";
import { sendInviteEmail } from "../invite-email.service";

export async function sendInviteEmailUseCase(input: unknown, context: RequestContext, deps?: InviteEmailServiceDeps) {
  return sendInviteEmail(
    input,
    {
      requestId: context.requestId,
      tenantContext: context.tenantContext!,
      authContext: context.authContext!,
    },
    deps,
  );
}
