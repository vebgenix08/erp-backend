import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryTenantRepository } from "../tenants.repository";
import {
  activateTenantUseCase,
  confirmTenantDeletionUseCase,
  createTenantUseCase,
  requestTenantDeletionUseCase,
  suspendTenantUseCase,
} from "../use-cases";
import { createPlatformAdminContext, createTenantFixture } from "./fixtures";

test("tenant lifecycle uses explicit suspend, activate, deletion request and confirmation commands", async () => {
  const repository = new InMemoryTenantRepository();
  const context = createPlatformAdminContext();
  const created = await createTenantUseCase(createTenantFixture(), context, { repository });
  if (!created) throw new Error("tenant was not created");
  const suspended = await suspendTenantUseCase(created.id, context, { repository });
  assert.equal(suspended?.status, "SUSPENDED");
  const active = await activateTenantUseCase(created.id, context, { repository });
  assert.equal(active?.status, "ACTIVE");
  const requested = await requestTenantDeletionUseCase(created.id, "Institution closed", context, { repository });
  assert.ok(requested?.deletionRequestedAt);
  assert.equal(requested?.status, "INACTIVE");
  const deleted = await confirmTenantDeletionUseCase(created.id, context, { repository });
  if (!deleted?.deletedAt || !deleted.purgeEligibleAt) throw new Error("deletion retention metadata was not created");
  assert.equal(deleted.deletedBy, "platform_admin_test");
  assert.equal(deleted.status, "INACTIVE");
  assert.equal(deleted.deletionReason, "Institution closed");
  assert.equal(
    Date.parse(deleted.purgeEligibleAt) - Date.parse(deleted.deletedAt),
    30 * 24 * 60 * 60 * 1000,
  );
});
