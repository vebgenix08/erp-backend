import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryCampusRepository } from "../campuses.repository";
import { createCampusUseCase, getCampusUseCase } from "../use-cases";
import { createCampusFixture } from "./fixtures";

test("get campus returns only the stored campus", async () => {
  const repository = new InMemoryCampusRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.campuses.create", "settings.campuses.read"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const created = await createCampusUseCase(context as any, createCampusFixture(), { repository });
  const result = await getCampusUseCase(context as any, created.id, { repository });
  assert.equal(result?.code, "CAMP-001");
});
