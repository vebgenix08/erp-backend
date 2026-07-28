import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createRoleUseCase, getRoleUseCase } from "../use-cases";
import { createRoleFixture } from "./fixtures";

test("get role returns tenant-scoped role", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createRoleUseCase(context, createRoleFixture({ code: "VIEWER", name: "Viewer" }));
  const found = await getRoleUseCase(context, String(created?.id ?? ""));

  assert.equal(found?.code, "VIEWER");
  assert.equal(found?.tenantId, "tenant-1");
});
