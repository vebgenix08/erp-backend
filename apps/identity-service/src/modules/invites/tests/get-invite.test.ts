import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryInviteDelivery } from "@school-erp/comms";
import { InMemoryInviteRepository } from "../invites.repository";
import { createInviteUseCase, getInviteUseCase } from "../use-cases";
import { createInviteContext } from "./fixtures";

test("get invite returns the tenant scoped record", async () => {
  const repository = new InMemoryInviteRepository();
  const delivery = createInMemoryInviteDelivery();
  const created = await createInviteUseCase(
    { email: "principal@example.test", role: "PRINCIPAL" },
    createInviteContext(),
    { repository, delivery },
  );

  const result = await getInviteUseCase(created.id, createInviteContext(), { repository, delivery });
  assert.equal(result?.id, created.id);
  assert.equal(result?.tenantId, "tenant_test_1");
});
