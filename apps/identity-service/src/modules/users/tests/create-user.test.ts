import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createUserUseCase } from "../use-cases";
import { createUserFixture } from "./fixtures";

test("create user stores tenant-scoped user", async () => {
  const result = await createUserUseCase(
    createTenantContext({ tenantId: "tenant-1", source: "request" }),
    createUserFixture(),
  );

  assert.equal(result?.tenantId, "tenant-1");
  assert.equal(result?.email, "user@example.com");
  assert.equal(result?.status, "ACTIVE");
});

test("create user rejects duplicate email within tenant", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  await createUserUseCase(context, createUserFixture({ email: "duplicate@example.com" }));

  await assert.rejects(
    () => createUserUseCase(context, createUserFixture({ email: "duplicate@example.com", authUserId: "auth-user-2" })),
    /user email must be unique within tenant/i,
  );
});
