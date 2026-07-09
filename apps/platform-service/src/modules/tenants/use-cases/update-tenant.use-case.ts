import { updateTenant as updateTenantService, type TenantServiceDeps } from "../tenants.service";

export async function updateTenantUseCase(id: string, input: Record<string, unknown>, deps?: TenantServiceDeps) {
  return updateTenantService(id, input, deps);
}
