import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createUserUseCase, deleteUserUseCase, getUserUseCase } from "../use-cases";
import { createUserFixture } from "./fixtures";

test("delete user removes tenant-scoped record", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createUserUseCase(context, createUserFixture({ email: "delete@example.com" }));

  const deleted = await deleteUserUseCase(context, String(created?.id ?? ""));
  assert.equal(deleted, true);

  const found = await getUserUseCase(context, String(created?.id ?? ""));
  assert.equal(found, null);
});
