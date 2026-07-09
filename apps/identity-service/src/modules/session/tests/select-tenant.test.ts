import test from "node:test";
import assert from "node:assert/strict";
import { createSessionContext } from "./fixtures";
import { InMemorySessionRepository } from "../session.repository";
import { selectTenantUseCase } from "../use-cases";

test("select tenant persists the selected tenant", async () => {
  const repository = new InMemorySessionRepository();
  const context = createSessionContext();
  const result = await selectTenantUseCase({ tenantId: "tenant_x" }, context, { repository });
  assert.equal(result.selectedTenant?.tenantId, "tenant_x");
});
