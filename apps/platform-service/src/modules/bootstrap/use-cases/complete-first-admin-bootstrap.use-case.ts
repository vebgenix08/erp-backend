import type { FirstAdminBootstrapServiceContext } from "../bootstrap.model";
import type { FirstAdminBootstrapServiceDeps } from "../bootstrap.service";
import { completeFirstAdminBootstrap } from "../bootstrap.service";

export async function completeFirstAdminBootstrapUseCase(
  tenantId: string,
  input: unknown,
  context: FirstAdminBootstrapServiceContext,
  deps?: FirstAdminBootstrapServiceDeps,
) {
  return completeFirstAdminBootstrap(tenantId, input, context, deps);
}
