import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createPermissionUseCase, deletePermissionUseCase, getPermissionUseCase } from "../use-cases";
import { createPermissionFixture } from "./fixtures";

test("delete permission removes tenant-scoped record", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createPermissionUseCase(context, createPermissionFixture({ code: "identity.users.delete" }));
  const deleted = await deletePermissionUseCase(context, String(created?.id ?? ""));
  assert.equal(deleted, true);
  const found = await getPermissionUseCase(context, String(created?.id ?? ""));
  assert.equal(found, null);
});
