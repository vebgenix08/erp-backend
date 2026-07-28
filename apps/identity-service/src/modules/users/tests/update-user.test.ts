import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createUserUseCase, updateUserUseCase } from "../use-cases";
import { createUserFixture, updateUserFixture } from "./fixtures";

test("update user changes mutable fields", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createUserUseCase(context, createUserFixture({ email: "update@example.com" }));
  const updated = await updateUserUseCase(context, String(created?.id ?? ""), updateUserFixture({ name: "Renamed User" }));

  assert.equal(updated?.name, "Renamed User");
  assert.equal(updated?.email, "update@example.com");
});
