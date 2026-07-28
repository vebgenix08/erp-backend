import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryCampusRepository } from "../campuses.repository";
import { createCampusUseCase } from "../use-cases";
import { createCampusFixture } from "./fixtures";

test("create campus stores a tenant-scoped campus", async () => {
  const repository = new InMemoryCampusRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.campuses.create"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const result = await createCampusUseCase(context as any, createCampusFixture(), { repository });
  assert.equal(result.name, "Main Campus");
  assert.equal(result.code, "CAMP-001");
  assert.equal(result.status, "ACTIVE");
});
