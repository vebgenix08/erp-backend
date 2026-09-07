import test from "node:test";
import assert from "node:assert/strict";
import { createSessionContext } from "./fixtures";
import { logoutUseCase } from "../use-cases";
import { InMemorySessionRepository } from "../session.repository";

test("logout returns success", async () => {
  const repository = new InMemorySessionRepository();
  await repository.saveSelectedTenant("user_test_1", {
    tenantId: "tenant_test_1",
    source: "request",
  });
  const result = await logoutUseCase(createSessionContext(), { repository });
  assert.equal(result.success, true);
  assert.equal(await repository.getSelectedTenant("user_test_1"), null);
});
