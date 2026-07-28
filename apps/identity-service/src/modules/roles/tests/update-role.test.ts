import test from "node:test";
import assert from "node:assert/strict";
import { createTenantContext } from "@school-erp/tenancy";
import { createRoleUseCase, updateRoleUseCase } from "../use-cases";
import { createRoleFixture, updateRoleFixture } from "./fixtures";

test("update role changes mutable fields", async () => {
  const context = createTenantContext({ tenantId: "tenant-1", source: "request" });
  const created = await createRoleUseCase(context, createRoleFixture({ code: "EDITOR", name: "Editor" }));
  const updated = await updateRoleUseCase(context, String(created?.id ?? ""), updateRoleFixture({ name: "Content Editor" }));

  assert.equal(updated?.name, "Content Editor");
  assert.equal(updated?.code, "EDITOR");
});
