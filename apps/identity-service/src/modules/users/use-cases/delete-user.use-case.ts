import type { TenantContext } from "@school-erp/tenancy";
import type { UserServiceDeps } from "../users.service";
import { deleteUser as deleteUserService } from "../users.service";

export async function deleteUserUseCase(context: TenantContext | undefined, id: string, deps?: UserServiceDeps) {
  return deleteUserService(context, id, deps);
}
