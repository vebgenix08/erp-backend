import type { TenantContext } from "@school-erp/tenancy";
import type { RoleServiceDeps } from "../roles.service";
import { deleteRole as deleteRoleService } from "../roles.service";

export async function deleteRoleUseCase(context: TenantContext | undefined, id: string, deps?: RoleServiceDeps) {
  return deleteRoleService(context, id, deps);
}
