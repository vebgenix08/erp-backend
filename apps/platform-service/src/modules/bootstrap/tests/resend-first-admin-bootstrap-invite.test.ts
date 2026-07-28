import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryFirstAdminBootstrapRepository } from "../bootstrap.repository";
import { createFirstAdminBootstrapUseCase, resendFirstAdminBootstrapInviteUseCase } from "../use-cases";
import { createBootstrapContext } from "./fixtures";

test("resend first admin invite uses resend delivery without creating another bootstrap", async () => {
  const repository = new InMemoryFirstAdminBootstrapRepository();
  let sends = 0;
  let resends = 0;
  const invitePort = {
    async sendFirstAdminInvite() { sends += 1; return { inviteId: "invite_1", sentAt: new Date("2026-01-01T00:00:00Z") }; },
    async resendFirstAdminInvite() { resends += 1; return { inviteId: "invite_1", sentAt: new Date("2026-01-02T00:00:00Z") }; },
  };
  const context = createBootstrapContext();
  await createFirstAdminBootstrapUseCase({ tenantId: "tenant_1", adminName: "Admin", adminEmail: "admin@example.test" }, context, { repository, invitePort });
  const result = await resendFirstAdminBootstrapInviteUseCase("tenant_1", context, { repository, invitePort });
  assert.equal(result.status, "INVITED");
  assert.equal(sends, 1);
  assert.equal(resends, 1);
  assert.equal((await repository.list()).length, 1);
});
