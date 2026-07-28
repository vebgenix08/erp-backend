import type { TenantContext } from "@school-erp/tenancy";
import { requireTenant } from "@school-erp/tenancy";
import { toPermissionView } from "./permissions.mapper";
import type { PermissionRepository } from "./permissions.repository";
import { permissionRepository as defaultRepository } from "./permissions.repository";
import { validatePermissionCreateInput, validatePermissionUpdateInput } from "./permissions.validator";

export type PermissionServiceDeps = {
  repository?: PermissionRepository | Promise<PermissionRepository>;
};

function resolveRepository(deps?: PermissionServiceDeps) {
  return deps?.repository ?? defaultRepository;
}

function resolveTenantId(context: TenantContext | undefined): string {
  return requireTenant(context).tenantId as string;
}

export async function listPermissions(context: TenantContext | undefined, deps?: PermissionServiceDeps) {
  const repository = await resolveRepository(deps);
  return (await repository.list(resolveTenantId(context))).map((permission) => toPermissionView(permission));
}

export async function getPermission(context: TenantContext | undefined, id: string, deps?: PermissionServiceDeps) {
  const repository = await resolveRepository(deps);
  return toPermissionView(await repository.getById(resolveTenantId(context), id));
}

export async function createPermission(
  context: TenantContext | undefined,
  input: Record<string, unknown>,
  deps?: PermissionServiceDeps,
) {
  const repository = await resolveRepository(deps);
  return toPermissionView(await repository.create(resolveTenantId(context), validatePermissionCreateInput(input)));
}

export async function updatePermission(
  context: TenantContext | undefined,
  id: string,
  input: Record<string, unknown>,
  deps?: PermissionServiceDeps,
) {
  const repository = await resolveRepository(deps);
  return toPermissionView(await repository.update(resolveTenantId(context), id, validatePermissionUpdateInput(input)));
}

export async function deletePermission(context: TenantContext | undefined, id: string, deps?: PermissionServiceDeps) {
  const repository = await resolveRepository(deps);
  return repository.delete(resolveTenantId(context), id);
}
