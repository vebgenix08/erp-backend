import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTenantRepository } from "../tenants.repository";
import { createTenantUseCase, deactivateTenantUseCase } from "../use-cases";
import { createPlatformAdminContext, createTenantFixture } from "./fixtures";

test("deactivate tenant marks the tenant inactive with a deactivated timestamp", async () => {
  const repository = new InMemoryTenantRepository();
  const created = await createTenantUseCase(createTenantFixture({ name: "Dormant School", code: "DORMANT" }), createPlatformAdminContext(), { repository });

  const deactivated = await deactivateTenantUseCase(String(created?.id ?? ""), createPlatformAdminContext(), { repository });
  assert.equal(deactivated?.status, "INACTIVE");
  assert.ok(deactivated?.deactivatedAt);
});
