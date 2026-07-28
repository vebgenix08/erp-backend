import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFirstAdminBootstrapRepository } from "../bootstrap.repository";
import { completeFirstAdminBootstrapUseCase, createFirstAdminBootstrapUseCase } from "../use-cases";
import { createBootstrapContext } from "./fixtures";

test("complete first admin bootstrap marks the bootstrap complete", async () => {
  const repository = new InMemoryFirstAdminBootstrapRepository();
  await createFirstAdminBootstrapUseCase(
    {
      tenantId: "tenant_1",
      adminName: "Admin User",
      adminEmail: "admin@example.test",
    },
    createBootstrapContext(),
    { repository },
  );

  const result = await completeFirstAdminBootstrapUseCase("tenant_1", { inviteId: "invite_1" }, createBootstrapContext(), { repository });
  assert.equal(result?.status, "COMPLETED");
  assert.equal(result?.inviteId, "invite_1");
});
