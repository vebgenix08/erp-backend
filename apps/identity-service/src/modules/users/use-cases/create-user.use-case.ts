import type { TenantContext } from "@school-erp/tenancy";
import type { UserServiceDeps } from "../users.service";
import { createUser as createUserService } from "../users.service";

export async function createUserUseCase(
  context: TenantContext | undefined,
  input: Record<string, unknown>,
  deps?: UserServiceDeps,
) {
  return createUserService(context, input, deps);
}
