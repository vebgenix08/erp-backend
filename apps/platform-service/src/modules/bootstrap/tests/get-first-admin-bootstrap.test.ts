import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFirstAdminBootstrapRepository } from "../bootstrap.repository";
import { createFirstAdminBootstrapUseCase, getFirstAdminBootstrapUseCase } from "../use-cases";
import { createBootstrapContext } from "./fixtures";

test("get first admin bootstrap returns tenant scoped record", async () => {
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

  const result = await getFirstAdminBootstrapUseCase("tenant_1", createBootstrapContext(), { repository });
  assert.equal(result?.tenantId, "tenant_1");
  assert.equal(result?.status, "PENDING");
});
