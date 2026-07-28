import type { FirstAdminBootstrapServiceContext } from "../bootstrap.model";
import type { FirstAdminBootstrapServiceDeps } from "../bootstrap.service";
import { getFirstAdminBootstrap } from "../bootstrap.service";

export async function getFirstAdminBootstrapUseCase(tenantId: string, context: FirstAdminBootstrapServiceContext, deps?: FirstAdminBootstrapServiceDeps) {
  return getFirstAdminBootstrap(tenantId, context, deps);
}
