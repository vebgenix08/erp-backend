import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTenantRepository } from "../tenants.repository";
import { createTenantUseCase, getTenantUseCase } from "../use-cases";
import { createPlatformAdminContext, createTenantFixture } from "./fixtures";

test("get tenant returns the stored tenant view", async () => {
  const repository = new InMemoryTenantRepository();
  const created = await createTenantUseCase(createTenantFixture({ name: "City College", code: "CITY", type: "COLLEGE" }), createPlatformAdminContext(), { repository });

  const found = await getTenantUseCase(String(created?.id ?? ""), createPlatformAdminContext(), { repository });
  assert.equal(found?.name, "City College");
  assert.equal(found?.code, "CITY");
  assert.equal(found?.type, "COLLEGE");
});
