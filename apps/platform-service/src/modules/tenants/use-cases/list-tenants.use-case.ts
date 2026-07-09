import { listTenants as listTenantsService, type TenantServiceDeps } from "../tenants.service";

export async function listTenantsUseCase(deps?: TenantServiceDeps) {
  return listTenantsService(deps);
}
