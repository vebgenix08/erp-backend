import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFirstAdminBootstrapRepository } from "../bootstrap.repository";
import { createFirstAdminBootstrapUseCase } from "../use-cases";
import { createBootstrapContext } from "./fixtures";

test("create first admin bootstrap stores pending record and sends invite via port", async () => {
  const repository = new InMemoryFirstAdminBootstrapRepository();
  const invitePort = {
    async sendFirstAdminInvite() {
      return { inviteId: "invite_1", sentAt: new Date("2026-01-01T00:00:00.000Z") };
    },
  };

  const result = await createFirstAdminBootstrapUseCase(
    {
      tenantId: "tenant_1",
      adminName: "Admin User",
      adminEmail: "admin@example.test",
    },
    createBootstrapContext(),
    { repository, invitePort },
  );

  assert.equal(result?.status, "INVITED");
  assert.equal(result?.inviteId, "invite_1");
});
