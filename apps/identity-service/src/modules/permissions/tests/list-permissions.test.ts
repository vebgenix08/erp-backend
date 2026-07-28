import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createPermissionUseCase, listPermissionsUseCase } from "../use-cases";
import { createPermissionFixture } from "./fixtures";

test("list permissions only returns current tenant records", async () => {
  const tenantOne = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const tenantTwo = createTenantContext({ tenantId: "tenant-2", source: "request" });
  await createPermissionUseCase(tenantOne, createPermissionFixture({ code: "identity.users.read" }));
  await createPermissionUseCase(tenantTwo, createPermissionFixture({ code: "identity.roles.read" }));

  const permissions = await listPermissionsUseCase(tenantOne);
  assert.equal(permissions.length, 1);
  assert.equal(permissions[0]?.code, "identity.users.read");
});
