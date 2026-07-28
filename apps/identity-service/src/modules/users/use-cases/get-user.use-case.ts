import type { TenantContext } from "@school-erp/tenancy";
import type { UserServiceDeps } from "../users.service";
import { getUser as getUserService } from "../users.service";

export async function getUserUseCase(context: TenantContext | undefined, id: string, deps?: UserServiceDeps) {
  return getUserService(context, id, deps);
}
