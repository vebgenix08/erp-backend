import type { RequestContext } from "@school-erp/api";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { ConflictError } from "@school-erp/errors";
import { requireTenantId } from "@school-erp/tenancy";
import { listRoles } from "../roles/roles.service";
import { createUser, getUserByAuthUserId } from "../users/users.service";
import { PERMISSION_CATALOG } from "./access.model";
import { accessPermissions } from "./access.permissions";
import { accessRepository, type AccessRepository } from "./access.repository";
import { validatePermissions, validateScope } from "./access.validator";

function tenant(context: RequestContext) { requireAuth(context.authContext); return requireTenantId(context.tenantContext); }

export async function bootstrapCurrentTenantAdmin(context: RequestContext) {
  const auth = requireAuth(context.authContext);
  const authUser = auth.user!;
  if (authUser.role !== "TENANT_ADMIN") return null;
  const email = authUser.email?.trim();
  if (!email) return null;
  let user = await getUserByAuthUserId(context.tenantContext, authUser.id);
  if (!user) {
    try { user = await createUser(context.tenantContext, { authUserId: authUser.id, email, name: email.split("@")[0] ?? "Tenant Admin", status: "ACTIVE" }); }
    catch (error) { if (!(error instanceof ConflictError)) throw error; }
  }
  if (!user) return null;
  const role = (await listRoles(context.tenantContext)).find((item) => item?.code === "TENANT_ADMIN");
  if (role) {
    try { await accessRepository.assignRole(tenant(context), user.id, role.id, { scopeType: "TENANT" }); }
    catch (error) { if (!(error instanceof ConflictError)) throw error; }
    const expected = PERMISSION_CATALOG.map((permission) => permission.code).sort();
    const stored = (await accessRepository.listRolePermissions(tenant(context))).filter((binding) => binding.roleId === role.id).map((binding) => binding.permission).sort();
    if (expected.length !== stored.length || expected.some((permission, index) => permission !== stored[index])) {
      await accessRepository.setRolePermissions(tenant(context), role.id, expected);
    }
  }
  return user;
}

export async function getAccessSnapshot(context: RequestContext, deps: { repository?: AccessRepository } = {}) {
  requirePermission(context.authContext, accessPermissions.read); const repository = deps.repository ?? accessRepository; const tenantId = tenant(context);
  return { permissions: PERMISSION_CATALOG, assignments: await repository.listAssignments(tenantId), rolePermissions: await repository.listRolePermissions(tenantId) };
}
export async function assignUserRole(input: unknown, context: RequestContext, deps: { repository?: AccessRepository } = {}) {
  requirePermission(context.authContext, accessPermissions.assignRole); const value = input as Record<string, unknown>; const userId = String(value?.userId ?? "").trim(), roleId = String(value?.roleId ?? "").trim();
  if (!userId || !roleId) throw new Error("userId and roleId are required");
  return (deps.repository ?? accessRepository).assignRole(tenant(context), userId, roleId, validateScope(value.scope));
}
export async function revokeUserRole(id: string, context: RequestContext, deps: { repository?: AccessRepository } = {}) { requirePermission(context.authContext, accessPermissions.assignRole); return (deps.repository ?? accessRepository).revokeAssignment(tenant(context), id); }
export async function saveRolePermissions(input: unknown, context: RequestContext, deps: { repository?: AccessRepository } = {}) {
  requirePermission(context.authContext, accessPermissions.assignPermission); const value = input as Record<string, unknown>; const roleId = String(value?.roleId ?? "").trim();
  if (!roleId) throw new Error("roleId is required"); return (deps.repository ?? accessRepository).setRolePermissions(tenant(context), roleId, validatePermissions(value.permissions));
}
