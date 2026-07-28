import test from "node:test";
import assert from "node:assert/strict";
import { generateTenantId, InMemoryTenantRepository } from "../tenants.repository";
import { createTenantUseCase } from "../use-cases";
import { createPlatformAdminContext, createTenantFixture } from "./fixtures";

test("create tenant stores an active tenant and enforces required fields", async () => {
  const repository = new InMemoryTenantRepository();
  const result = await createTenantUseCase(createTenantFixture(), createPlatformAdminContext(), { repository });

  assert.equal(result?.name, "Sample School");
  assert.equal(result?.code, "SAMPLE-SCHOOL");
  assert.equal(result?.status, "ACTIVE");
  assert.equal(result?.type, "SCHOOL");
  assert.ok(result?.createdAt);
  assert.ok(result?.updatedAt);
});

test("create tenant rejects duplicate code", async () => {
  const repository = new InMemoryTenantRepository();
  const duplicate = createTenantFixture({ code: "DUP" });
  await createTenantUseCase(duplicate, createPlatformAdminContext(), { repository });

  await assert.rejects(
    () => createTenantUseCase(createTenantFixture({ name: "Two", code: "DUP", type: "COLLEGE" }), createPlatformAdminContext(), { repository }),
    /tenant code must be unique/i,
  );
});

test("tenant ids use the compact tenant prefix format", () => {
  const ids = new Set(Array.from({ length: 1_000 }, generateTenantId));
  assert.equal(ids.size, 1_000);
  for (const id of ids) assert.equal(/^tenant_[A-HJ-NP-Z2-9]{6}$/.test(id), true);
});
