import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTenantRepository } from "../tenants.repository";
import { createTenantUseCase, updateTenantUseCase } from "../use-cases";
import { createTenantFixture } from "./fixtures";

test("update tenant changes mutable fields", async () => {
  const repository = new InMemoryTenantRepository();
  const created = await createTenantUseCase(createTenantFixture({ name: "Old Name", code: "OLD" }), { repository });

  const updated = await updateTenantUseCase(String(created?.id ?? ""), { name: "New Name" }, { repository });
  assert.equal(updated?.name, "New Name");
  assert.equal(updated?.code, "OLD");
});

test("update tenant rejects duplicate code", async () => {
  const repository = new InMemoryTenantRepository();
  const first = await createTenantUseCase(createTenantFixture({ name: "First", code: "FIRST" }), { repository });
  await createTenantUseCase(createTenantFixture({ name: "Second", code: "SECOND", type: "COLLEGE" }), { repository });

  await assert.rejects(
    () => updateTenantUseCase(String(first?.id ?? ""), { code: "SECOND" }, { repository }),
    /tenant code must be unique/i,
  );
});
