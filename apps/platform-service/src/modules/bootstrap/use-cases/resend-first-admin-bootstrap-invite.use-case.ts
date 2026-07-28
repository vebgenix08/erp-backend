import type { RequestContext } from "@school-erp/api";
import { resendFirstAdminBootstrapInvite, type FirstAdminBootstrapServiceDeps } from "../bootstrap.service";
import type { FirstAdminBootstrapServiceContext } from "../bootstrap.model";

export function resendFirstAdminBootstrapInviteUseCase(tenantId: string, context: FirstAdminBootstrapServiceContext | RequestContext, deps?: FirstAdminBootstrapServiceDeps) {
  return resendFirstAdminBootstrapInvite(tenantId, context, deps);
}
