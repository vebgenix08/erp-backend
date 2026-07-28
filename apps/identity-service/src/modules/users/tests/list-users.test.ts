import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createUserUseCase, listUsersUseCase } from "../use-cases";
import { createUserFixture } from "./fixtures";

test("list users only returns current tenant records", async () => {
  const tenantOne = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const tenantTwo = createTenantContext({ tenantId: "tenant-2", source: "request" });
  await createUserUseCase(tenantOne, createUserFixture({ email: "one@example.com" }));
  await createUserUseCase(tenantTwo, createUserFixture({ email: "two@example.com" }));

  const users = await listUsersUseCase(tenantOne);
  assert.equal(users.length, 1);
  assert.equal(users[0]?.email, "one@example.com");
});
