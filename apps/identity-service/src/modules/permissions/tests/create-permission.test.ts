import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createPermissionUseCase } from "../use-cases";
import { createPermissionFixture } from "./fixtures";

test("create permission stores a tenant-scoped permission", async () => {
  const result = await createPermissionUseCase(
    createTenantContext({ tenantId: "tenant-1", source: "request" }),
    createPermissionFixture(),
  );

  assert.equal(result?.tenantId, "tenant-1");
  assert.equal(result?.code, "identity.users.read");
});

test("create permission rejects invalid permission code", async () => {
  await assert.rejects(
    () =>
      createPermissionUseCase(
        createTenantContext({ tenantId: "tenant-1", source: "request" }),
        createPermissionFixture({ code: "bad-code" }),
      ),
    /Validation failed/i,
  );
});
