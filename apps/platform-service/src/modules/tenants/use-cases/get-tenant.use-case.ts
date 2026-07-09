import { getTenant as getTenantService, type TenantServiceDeps } from "../tenants.service";

export async function getTenantUseCase(id: string, deps?: TenantServiceDeps) {
  return getTenantService(id, deps);
}
