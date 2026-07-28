import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryCampusRepository } from "../campuses.repository";
import { createCampusUseCase, listCampusesUseCase } from "../use-cases";
import { createCampusFixture } from "./fixtures";

test("list campuses sorts by name", async () => {
  const repository = new InMemoryCampusRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.campuses.create", "settings.campuses.read"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  await createCampusUseCase(context as any, createCampusFixture({ name: "Beta Campus" }), { repository });
  await createCampusUseCase(context as any, createCampusFixture({ name: "Alpha Campus" }), { repository });
  const results = await listCampusesUseCase(context as any, { repository });
  assert.equal(results[0]?.name, "Alpha Campus");
});
