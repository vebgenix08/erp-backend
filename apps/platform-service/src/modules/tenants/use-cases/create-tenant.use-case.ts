import { createTenant as createTenantService, type TenantServiceDeps } from "../tenants.service";
import type { RequestContext } from "@school-erp/api";

export async function createTenantUseCase(input: Record<string, unknown>, context: RequestContext, deps?: TenantServiceDeps) {
  return createTenantService(input, context, deps);
}
