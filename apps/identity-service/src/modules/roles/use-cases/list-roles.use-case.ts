import type { TenantContext } from "@school-erp/tenancy";
import type { RoleServiceDeps } from "../roles.service";
import { listRoles as listRolesService } from "../roles.service";

export async function listRolesUseCase(context: TenantContext | undefined, deps?: RoleServiceDeps) {
  return listRolesService(context, deps);
}
