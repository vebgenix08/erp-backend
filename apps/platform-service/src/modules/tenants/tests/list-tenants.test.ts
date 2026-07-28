import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTenantRepository } from "../tenants.repository";
import { createTenantUseCase, listTenantsUseCase } from "../use-cases";
import { createPlatformAdminContext, createTenantFixture } from "./fixtures";

test("list tenants returns tenants sorted by name", async () => {
  const repository = new InMemoryTenantRepository();
  await createTenantUseCase(createTenantFixture({ name: "Zeta School", code: "ZETA" }), createPlatformAdminContext(), { repository });
  await createTenantUseCase(createTenantFixture({ name: "Alpha College", code: "ALPHA", type: "COLLEGE" }), createPlatformAdminContext(), { repository });

  const tenants = await listTenantsUseCase(createPlatformAdminContext(), { repository });
  assert.equal(tenants.length, 2);
  assert.equal(tenants[0]?.name, "Alpha College");
  assert.equal(tenants[1]?.name, "Zeta School");
});
