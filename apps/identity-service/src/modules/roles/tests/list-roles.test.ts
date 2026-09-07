import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createRoleUseCase, listRolesUseCase } from "../use-cases";
import { createRoleFixture } from "./fixtures";

test("list roles only returns current tenant records", async () => {
  const tenantOne = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const tenantTwo = createTenantContext({ tenantId: "tenant-2", source: "request" });
  await createRoleUseCase(tenantOne, createRoleFixture({ code: "ONE", name: "One" }));
  await createRoleUseCase(tenantTwo, createRoleFixture({ code: "TWO", name: "Two" }));

  const roles = await listRolesUseCase(tenantOne);
  assert.ok(roles.some((role) => role?.code === "ONE"));
  assert.ok(roles.some((role) => role?.code === "TENANT_ADMIN" && role.isSystemRole));
  for (const code of [
    "TEACHER",
    "CLASS_TEACHER",
    "HOD",
    "ACADEMIC_COORDINATOR",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "DEAN",
  ]) {
    assert.ok(
      roles.some((role) => role?.code === code && role.isSystemRole),
      `${code} system role is required`,
    );
  }
  assert.ok(!roles.some((role) => role?.code === "TWO"));
  assert.ok(roles.every((role) => role?.tenantId === "tenant-1"));
});
