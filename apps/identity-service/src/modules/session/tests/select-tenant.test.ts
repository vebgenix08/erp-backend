import test from "node:test";
import assert from "node:assert/strict";
import { createSessionContext } from "./fixtures";
import { InMemorySessionRepository } from "../session.repository";
import { selectTenantUseCase } from "../use-cases";

test("select tenant persists the selected tenant", async () => {
  const repository = new InMemorySessionRepository();
  const context = createSessionContext();
  const result = await selectTenantUseCase({ tenantId: "tenant_test_1" }, context, {
    repository,
    employeeResolver: async () => ({
      fullName: "Ananya Rao",
      profilePhotoFileId: "file-profile-1",
    }),
  });
  assert.equal(result.selectedTenant?.tenantId, "tenant_test_1");
  assert.equal(result.user.profilePhotoFileId, "file-profile-1");
});

test("select tenant rejects a tenant outside the authenticated membership", async () => {
  const repository = new InMemorySessionRepository();
  const context = createSessionContext();
  await assert.rejects(
    () =>
      selectTenantUseCase({ tenantId: "tenant_other" }, context, {
        repository,
      }),
    /not an authenticated membership/i,
  );
});
