import type { TenantContext } from "@school-erp/tenancy";
import type { UserServiceDeps } from "../users.service";
import { updateUser as updateUserService } from "../users.service";

export async function updateUserUseCase(
  context: TenantContext | undefined,
  id: string,
  input: Record<string, unknown>,
  deps?: UserServiceDeps,
) {
  return updateUserService(context, id, input, deps);
}
