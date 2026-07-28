import { deactivateTenant as deactivateTenantService, type TenantServiceDeps } from "../tenants.service";
import type { RequestContext } from "@school-erp/api";

export async function deactivateTenantUseCase(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  return deactivateTenantService(id, context, deps);
}
