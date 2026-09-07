import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryAccessRepository } from "../access.repository";
import { resolvePrincipalAuthorization } from "../authorization.service";
import type { RoleRepository } from "../../roles/roles.repository";
import type { UserRepository } from "../../users/users.repository";

test("authorization is resolved from active tenant role assignments", async () => {
  const access = new InMemoryAccessRepository();
  await access.assignRole("tenant-1", "user-1", "role-1", {
    scopeType: "CAMPUS",
    campusIds: ["campus-1"],
  });
  await access.setRolePermissions("tenant-1", "role-1", [
    "academics.student.read",
    "settings.academicYears.read",
  ]);
  const now = new Date();
  const users = {
    getByAuthUserId: async (tenantId: string, principalId: string) =>
      tenantId === "tenant-1" && principalId === "principal-1"
        ? {
            id: "user-1",
            tenantId,
            authUserId: principalId,
            email: "teacher@example.com",
            name: "Teacher",
            status: "ACTIVE" as const,
            createdAt: now,
            updatedAt: now,
          }
        : null,
  } as UserRepository;
  const roles = {
    list: async (tenantId: string) => [
      {
        id: "role-1",
        tenantId,
        code: "TEACHER",
        name: "Teacher",
        isSystemRole: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  } as RoleRepository;

  const snapshot = await resolvePrincipalAuthorization("tenant-1", "principal-1", {
    accessRepository: access,
    userRepository: users,
    roleRepository: roles,
  });

  assert.equal(snapshot?.role, "TEACHER");
  assert.deepEqual(snapshot?.permissions, [
    "academics.student.read",
    "settings.academicyears.read",
  ]);
  assert.deepEqual(snapshot?.scopes[0]?.scope, {
    scopeType: "CAMPUS",
    campusIds: ["campus-1"],
  });
  assert.equal(
    await resolvePrincipalAuthorization("tenant-2", "principal-1", {
      accessRepository: access,
      userRepository: users,
      roleRepository: roles,
    }),
    null,
  );
});
