import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createRoleUseCase, deleteRoleUseCase, getRoleUseCase } from "../use-cases";
import { createRoleFixture } from "./fixtures";

test("delete role removes tenant-scoped record", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createRoleUseCase(context, createRoleFixture({ code: "DEL", name: "Delete" }));
  const deleted = await deleteRoleUseCase(context, String(created?.id ?? ""));
  assert.equal(deleted, true);
  const found = await getRoleUseCase(context, String(created?.id ?? ""));
  assert.equal(found, null);
});
