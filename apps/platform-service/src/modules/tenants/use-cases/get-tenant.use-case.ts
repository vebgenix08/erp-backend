import { getTenant as getTenantService, type TenantServiceDeps } from "../tenants.service";
import type { RequestContext } from "@school-erp/api";

export async function getTenantUseCase(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  return getTenantService(id, context, deps);
}
