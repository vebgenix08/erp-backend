import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createUserUseCase, getUserUseCase } from "../use-cases";
import { createUserFixture } from "./fixtures";

test("get user returns tenant-scoped user", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createUserUseCase(context, createUserFixture({ email: "read@example.com" }));

  const found = await getUserUseCase(context, String(created?.id ?? ""));
  assert.equal(found?.email, "read@example.com");
  assert.equal(found?.tenantId, "tenant-1");
});
