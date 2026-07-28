import type { TenantContext } from "@school-erp/tenancy";
import type { UserServiceDeps } from "../users.service";
import { listUsers as listUsersService } from "../users.service";

export async function listUsersUseCase(context: TenantContext | undefined, deps?: UserServiceDeps) {
  return listUsersService(context, deps);
}
