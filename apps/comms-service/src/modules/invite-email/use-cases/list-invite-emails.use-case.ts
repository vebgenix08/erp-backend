import type { RequestContext } from "@school-erp/api";
import type { InviteEmailListFilter } from "../invite-email.model";
import type { InviteEmailServiceDeps } from "../invite-email.service";
import { listInviteEmails } from "../invite-email.service";

export async function listInviteEmailsUseCase(context: RequestContext, deps?: InviteEmailServiceDeps, filter?: InviteEmailListFilter) {
  return listInviteEmails(
    {
      requestId: context.requestId,
      tenantContext: context.tenantContext!,
      authContext: context.authContext!,
    },
    deps,
    filter,
  );
}
