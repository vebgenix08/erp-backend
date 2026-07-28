import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFirstAdminBootstrapRepository } from "../../modules/bootstrap/bootstrap.repository";
import { createFirstAdminBootstrap } from "../../modules/bootstrap/bootstrap.service";
import { handlePostAuthentication } from "../cognito-post-authentication";
import { createPlatformAdminContext } from "../../modules/tenants/tests/fixtures";

test("tenant administrator first login completes bootstrap idempotently", async () => {
  const repository = new InMemoryFirstAdminBootstrapRepository();
  const context = createPlatformAdminContext();
  context.authContext!.user!.permissions.push("platform.bootstrap.create", "platform.bootstrap.complete");
  await createFirstAdminBootstrap({ tenantId: "tenant-1", adminName: "Tenant Admin", adminEmail: "admin@example.com" }, context, { repository });
  const event = { userName: "admin@example.com", request: { userAttributes: { sub: "user-1", email: "admin@example.com", "custom:role": "TENANT_ADMIN", "custom:tenantId": "tenant-1" } } };
  await handlePostAuthentication(event, { repository });
  const completed = await repository.getByTenantId("tenant-1");
  assert.equal(completed?.status, "COMPLETED");
  const firstCompletion = completed?.completedAt?.toISOString();
  await handlePostAuthentication(event, { repository });
  assert.equal((await repository.getByTenantId("tenant-1"))?.completedAt?.toISOString(), firstCompletion);
});
