import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryTenantRepository } from "../tenants.repository";
import { createTenantUseCase } from "../use-cases";
import { createTenantFixture } from "./fixtures";

test("create tenant stores an active tenant and enforces required fields", async () => {
  const repository = new InMemoryTenantRepository();
  const result = await createTenantUseCase(createTenantFixture(), { repository });

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
  await createTenantUseCase(duplicate, { repository });

  await assert.rejects(
    () => createTenantUseCase(createTenantFixture({ name: "Two", code: "DUP", type: "COLLEGE" }), { repository }),
    /tenant code must be unique/i,
  );
});
