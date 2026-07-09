import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryCampusRepository } from "../campuses.repository";
import { createCampusUseCase, updateCampusUseCase } from "../use-cases";
import { createCampusFixture } from "./fixtures";

test("update campus changes mutable fields", async () => {
  const repository = new InMemoryCampusRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.campuses.create", "settings.campuses.update"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const created = await createCampusUseCase(context as any, createCampusFixture(), { repository });
  const updated = await updateCampusUseCase(context as any, created.id, { name: "Updated Campus" }, { repository });
  assert.equal(updated?.name, "Updated Campus");
});
