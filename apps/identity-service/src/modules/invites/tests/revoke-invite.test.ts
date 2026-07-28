import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryInviteDelivery } from "@school-erp/comms";
import { InMemoryInviteRepository } from "../invites.repository";
import { createInviteUseCase, revokeInviteUseCase, resendInviteUseCase } from "../use-cases";
import { createInviteContext } from "./fixtures";

test("revoke invite stops future resends", async () => {
  const repository = new InMemoryInviteRepository();
  const delivery = createInMemoryInviteDelivery();
  const created = await createInviteUseCase(
    { email: "revoke@example.test", role: "TEACHER" },
    createInviteContext(),
    { repository, delivery },
  );

  const revoked = await revokeInviteUseCase(created.id, createInviteContext(), { repository, delivery });
  assert.equal(revoked?.status, "REVOKED");

  await assert.rejects(
    () => resendInviteUseCase(created.id, createInviteContext(), { repository, delivery }),
    /invite cannot be resent/,
  );
});
