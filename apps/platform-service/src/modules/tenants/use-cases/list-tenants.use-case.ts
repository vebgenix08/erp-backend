import { listTenants as listTenantsService, type TenantServiceDeps } from "../tenants.service";
import type { RequestContext } from "@school-erp/api";

export async function listTenantsUseCase(context: RequestContext, deps?: TenantServiceDeps) {
  return listTenantsService(context, deps);
}
