import { createTenant as createTenantService, type TenantServiceDeps } from "../tenants.service";

export async function createTenantUseCase(input: Record<string, unknown>, deps?: TenantServiceDeps) {
  return createTenantService(input, deps);
}
