import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryCampusRepository } from "../campuses.repository";
import { createCampusUseCase, deactivateCampusUseCase } from "../use-cases";
import { createCampusFixture } from "./fixtures";

test("deactivate campus marks the campus inactive", async () => {
  const repository = new InMemoryCampusRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.campuses.create", "settings.campuses.deactivate"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const created = await createCampusUseCase(context as any, createCampusFixture(), { repository });
  const deactivated = await deactivateCampusUseCase(context as any, created.id, { repository });
  assert.equal(deactivated?.status, "INACTIVE");
  assert.ok(deactivated?.deactivatedAt);
});
