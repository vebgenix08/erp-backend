import type { TenantContext } from "@school-erp/tenancy";
import { requireTenant } from "@school-erp/tenancy";
import { toUserView } from "./users.mapper";
import type { UserRepository } from "./users.repository";
import { createUserRepository } from "./users.repository";
import { validateUserCreateInput, validateUserUpdateInput } from "./users.validator";

export type UserServiceDeps = {
  repository?: UserRepository | Promise<UserRepository>;
};

let defaultRepository: Promise<UserRepository> | undefined;
function resolveRepository(deps?: UserServiceDeps) { return deps?.repository ?? (defaultRepository ??= createUserRepository()); }

function resolveTenantId(context: TenantContext | undefined): string {
  return requireTenant(context).tenantId as string;
}

export async function listUsers(context: TenantContext | undefined, deps?: UserServiceDeps) {
  const repository = await resolveRepository(deps);
  return (await repository.list(resolveTenantId(context))).map((user) => toUserView(user));
}

export async function getUser(context: TenantContext | undefined, id: string, deps?: UserServiceDeps) {
  const repository = await resolveRepository(deps);
  return toUserView(await repository.getById(resolveTenantId(context), id));
}

export async function getUserByAuthUserId(context: TenantContext | undefined, authUserId: string, deps?: UserServiceDeps) {
  const repository = await resolveRepository(deps);
  return toUserView(await repository.getByAuthUserId(resolveTenantId(context), authUserId));
}

export async function createUser(context: TenantContext | undefined, input: Record<string, unknown>, deps?: UserServiceDeps) {
  const repository = await resolveRepository(deps);
  const tenantId = resolveTenantId(context);
  const payload = validateUserCreateInput(input);
  return toUserView(await repository.create(tenantId, payload));
}

export async function updateUser(
  context: TenantContext | undefined,
  id: string,
  input: Record<string, unknown>,
  deps?: UserServiceDeps,
) {
  const repository = await resolveRepository(deps);
  const tenantId = resolveTenantId(context);
  const payload = validateUserUpdateInput(input);
  return toUserView(await repository.update(tenantId, id, payload));
}

export async function deleteUser(context: TenantContext | undefined, id: string, deps?: UserServiceDeps) {
  const repository = await resolveRepository(deps);
  const tenantId = resolveTenantId(context);
  return repository.delete(tenantId, id);
}
