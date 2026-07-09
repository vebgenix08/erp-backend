import { ConflictError } from "@school-erp/errors";
import type { TenantRepository } from "./tenants.repository";
import { tenantRepository as defaultRepository } from "./tenants.repository";
import { toTenantView } from "./tenants.mapper";
import { validateTenantCreateInput, validateTenantUpdateInput } from "./tenants.validator";

export type TenantServiceDeps = {
  repository?: TenantRepository;
};

function resolveRepository(deps?: TenantServiceDeps) {
  return deps?.repository ?? defaultRepository;
}

export async function listTenants(deps?: TenantServiceDeps) {
  const repository = resolveRepository(deps);
  const tenants = await repository.list();
  return tenants.map((tenant) => toTenantView(tenant));
}

export async function getTenant(id: string, deps?: TenantServiceDeps) {
  const repository = resolveRepository(deps);
  const tenant = await repository.getById(id);
  if (!tenant) return null;
  return toTenantView(tenant);
}

export async function createTenant(input: Record<string, unknown>, deps?: TenantServiceDeps) {
  const repository = resolveRepository(deps);
  const payload = validateTenantCreateInput(input);
  const existing = await repository.getByCode(payload.code);
  if (existing) {
    throw new ConflictError("tenant code must be unique");
  }
  return toTenantView(await repository.create(payload));
}

export async function updateTenant(id: string, input: Record<string, unknown>, deps?: TenantServiceDeps) {
  const repository = resolveRepository(deps);
  const payload = validateTenantUpdateInput(input);
  if (payload.code) {
    const existing = await repository.getByCode(payload.code);
    if (existing && existing.id !== id) {
      throw new ConflictError("tenant code must be unique");
    }
  }
  const updated = await repository.update(id, payload);
  if (!updated) return null;
  return toTenantView(updated);
}

export async function deactivateTenant(id: string, deps?: TenantServiceDeps) {
  const repository = resolveRepository(deps);
  const existing = await repository.getById(id);
  if (!existing) return null;
  if (existing.status === "INACTIVE") return toTenantView(existing);
  return toTenantView(await repository.update(id, { status: "INACTIVE", deactivatedAt: new Date() }));
}
