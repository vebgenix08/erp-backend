import { ConflictError } from "@school-erp/errors";
import type { RequestContext } from "@school-erp/api";
import { platformPermissions } from "../../permissions";
import { requirePlatformPermission } from "../../middleware";
import type { TenantRepository } from "./tenants.repository";
import { createTenantRepository } from "./tenants.repository";
import { toTenantView } from "./tenants.mapper";
import { validateTenantCreateInput, validateTenantUpdateInput } from "./tenants.validator";

export type TenantServiceDeps = {
  repository?: TenantRepository | Promise<TenantRepository>;
};

async function resolveRepository(deps?: TenantServiceDeps) {
  return deps?.repository ?? createTenantRepository();
}

export async function listTenants(context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.read);
  const repository = await resolveRepository(deps);
  const tenants = await repository.list();
  return tenants.map((tenant) => toTenantView(tenant));
}

export async function getTenant(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.read);
  const repository = await resolveRepository(deps);
  const tenant = await repository.getById(id);
  if (!tenant) return null;
  return toTenantView(tenant);
}

export async function createTenant(input: Record<string, unknown>, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.create);
  const repository = await resolveRepository(deps);
  const payload = validateTenantCreateInput(input);
  const repeated = await repository.getByClientRequestId(payload.clientRequestId);
  if (repeated) return toTenantView(repeated);
  const existing = await repository.getByCode(payload.code);
  if (existing) {
    throw new ConflictError("tenant code must be unique");
  }
  return toTenantView(await repository.create(payload));
}

export async function updateTenant(id: string, input: Record<string, unknown>, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.update);
  const repository = await resolveRepository(deps);
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

export async function deactivateTenant(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.update);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(id);
  if (!existing) return null;
  if (existing.status === "INACTIVE") return toTenantView(existing);
  return toTenantView(await repository.update(id, { status: "INACTIVE", deactivatedAt: new Date() }));
}

export async function activateTenant(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.update);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(id);
  if (!existing || existing.deletedAt) return null;
  if (existing.status === "ACTIVE") return toTenantView(existing);
  return toTenantView(await repository.update(id, { status: "ACTIVE", deactivatedAt: undefined }));
}

export async function suspendTenant(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.update);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(id);
  if (!existing || existing.deletedAt) return null;
  if (existing.status === "SUSPENDED") return toTenantView(existing);
  return toTenantView(await repository.update(id, { status: "SUSPENDED", deactivatedAt: new Date() }));
}

export async function requestTenantDeletion(id: string, reason: string, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.delete);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(id);
  if (!existing || existing.deletedAt) return null;
  if (existing.deletionRequestedAt) return toTenantView(existing);
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new ConflictError("tenant deletion reason is required");
  return toTenantView(await repository.update(id, {
    status: "INACTIVE",
    deactivatedAt: existing.deactivatedAt ?? new Date(),
    deletionRequestedAt: new Date(),
    deletionRequestedBy: context.authContext?.user?.id,
    deletionReason: normalizedReason,
  }));
}

export async function confirmTenantDeletion(id: string, context: RequestContext, deps?: TenantServiceDeps) {
  requirePlatformPermission(context, platformPermissions.tenants.delete);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(id);
  if (!existing) return null;
  if (existing.deletedAt) return toTenantView(existing);
  if (!existing.deletionRequestedAt) throw new ConflictError("tenant deletion must be requested before confirmation");
  return toTenantView(await repository.update(id, {
    status: "INACTIVE",
    deletedAt: new Date(),
    deletedBy: context.authContext?.user?.id,
    purgeEligibleAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }));
}
