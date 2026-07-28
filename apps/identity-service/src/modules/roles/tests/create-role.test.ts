import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createRoleUseCase } from "../use-cases";
import { createRoleFixture } from "./fixtures";

test("create role stores a tenant-scoped role", async () => {
  const result = await createRoleUseCase(createTenantContext({ tenantId: "tenant-1", source: "request" }), createRoleFixture());
  assert.equal(result?.tenantId, "tenant-1");
  assert.equal(result?.code, "ADMIN");
  assert.equal(result?.isActive, true);
});

test("create role rejects duplicate code within tenant", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  await createRoleUseCase(context, createRoleFixture({ code: "DUP" }));

  await assert.rejects(
    () => createRoleUseCase(context, createRoleFixture({ code: "DUP", name: "Duplicate" })),
    /role code must be unique within tenant/i,
  );
});
