import type { TenantContext } from "@school-erp/tenancy";
import type { RoleServiceDeps } from "../roles.service";
import { getRole as getRoleService } from "../roles.service";

export async function getRoleUseCase(context: TenantContext | undefined, id: string, deps?: RoleServiceDeps) {
  return getRoleService(context, id, deps);
}
