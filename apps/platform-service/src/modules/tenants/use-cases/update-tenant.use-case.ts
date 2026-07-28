import { updateTenant as updateTenantService, type TenantServiceDeps } from "../tenants.service";
import type { RequestContext } from "@school-erp/api";

export async function updateTenantUseCase(id: string, input: Record<string, unknown>, context: RequestContext, deps?: TenantServiceDeps) {
  return updateTenantService(id, input, context, deps);
}
