import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createPermissionUseCase, getPermissionUseCase } from "../use-cases";
import { createPermissionFixture } from "./fixtures";

test("get permission returns tenant-scoped permission", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createPermissionUseCase(context, createPermissionFixture({ code: "identity.roles.read" }));
  const found = await getPermissionUseCase(context, String(created?.id ?? ""));

  assert.equal(found?.code, "identity.roles.read");
  assert.equal(found?.tenantId, "tenant-1");
});
