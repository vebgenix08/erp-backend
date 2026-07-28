import type { FirstAdminBootstrapServiceContext } from "../bootstrap.model";
import type { FirstAdminBootstrapServiceDeps } from "../bootstrap.service";
import { createFirstAdminBootstrap } from "../bootstrap.service";

export async function createFirstAdminBootstrapUseCase(input: unknown, context: FirstAdminBootstrapServiceContext, deps?: FirstAdminBootstrapServiceDeps) {
  return createFirstAdminBootstrap(input, context, deps);
}
