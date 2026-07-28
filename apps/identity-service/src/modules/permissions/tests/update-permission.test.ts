import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createPermissionUseCase, updatePermissionUseCase } from "../use-cases";
import { createPermissionFixture, updatePermissionFixture } from "./fixtures";

test("update permission changes mutable fields", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createPermissionUseCase(context, createPermissionFixture({ code: "identity.users.update" }));
  const updated = await updatePermissionUseCase(
    context,
    String(created?.id ?? ""),
    updatePermissionFixture({ description: "Can update users" }),
  );

  assert.equal(updated?.description, "Can update users");
});
