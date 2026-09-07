import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { ConflictError } from "@school-erp/errors";
import { bootstrapCurrentTenantAdmin } from "../access.service";
import { PERMISSION_CATALOG } from "../access.model";
import { InMemoryAccessRepository } from "../access.repository";
import type { RoleRepository } from "../../roles/roles.repository";
import type { UserRecord } from "../../users/users.model";
import type { UserRepository } from "../../users/users.repository";

test("tenant admin bootstrap relinks an active same-tenant user by email", async () => {
  const now = new Date();
  let user: UserRecord = {
    id: "user-1",
    tenantId: "tenant-1",
    authUserId: "old-principal",
    email: "admin@example.com",
    name: "Tenant Admin",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  const users = {
    getByAuthUserId: async (_tenantId: string, principalId: string) =>
      user.authUserId === principalId ? user : null,
    getByEmail: async (_tenantId: string, email: string) =>
      user.email === email.toLowerCase() ? user : null,
    create: async () => {
      throw new ConflictError("user email must be unique within tenant");
    },
    update: async (_tenantId: string, _id: string, input: { authUserId?: string }) => {
      user = { ...user, authUserId: input.authUserId ?? user.authUserId, updatedAt: new Date() };
      return user;
    },
  } as unknown as UserRepository;
  const tenantAdminRole = {
    id: "tenant-admin-role",
    tenantId: "tenant-1",
    code: "TENANT_ADMIN",
    name: "Tenant Admin",
    isSystemRole: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  const roles = {
    list: async () => [tenantAdminRole],
    create: async () => tenantAdminRole,
  } as unknown as RoleRepository;
  const access = new InMemoryAccessRepository();
  const context = {
    requestId: "request-1",
    path: "/session/me",
    method: "GET",
    headers: {},
    query: {},
    body: undefined,
    params: {},
    tenantContext: { tenantId: "tenant-1", source: "jwt-claims", resolvedAt: now },
    authContext: {
      source: "jwt-claims",
      authenticatedAt: now,
      user: {
        id: "current-principal",
        email: "admin@example.com",
        role: "TENANT_ADMIN",
        permissions: [],
        source: "jwt-claims",
      },
    },
  } as unknown as RequestContext;

  const result = await bootstrapCurrentTenantAdmin(context, {
    accessRepository: access,
    roleRepository: roles,
    userRepository: users,
  });

  assert.equal(result?.authUserId, "current-principal");
  assert.equal(
    (await access.listAssignmentPage("tenant-1", { userId: "user-1" })).items[0]?.roleId,
    "tenant-admin-role",
  );
  const permissions = (await access.listRolePermissions("tenant-1")).map(
    (binding) => binding.permission,
  );
  assert.equal(permissions.length, PERMISSION_CATALOG.length);
  assert.ok(permissions.includes("settings.dashboard.read"));
});
