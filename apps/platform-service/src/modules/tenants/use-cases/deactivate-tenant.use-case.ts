import { deactivateTenant as deactivateTenantService, type TenantServiceDeps } from "../tenants.service";

export async function deactivateTenantUseCase(id: string, deps?: TenantServiceDeps) {
  return deactivateTenantService(id, deps);
}
