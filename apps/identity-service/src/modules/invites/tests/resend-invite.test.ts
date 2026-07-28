import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryInviteDelivery } from "@school-erp/comms";
import { InMemoryInviteRepository } from "../invites.repository";
import { createInviteUseCase, resendInviteUseCase } from "../use-cases";
import { createInviteContext } from "./fixtures";

test("resend invite triggers another delivery", async () => {
  const repository = new InMemoryInviteRepository();
  const delivery = createInMemoryInviteDelivery();
  const created = await createInviteUseCase(
    { email: "resend@example.test", role: "TEACHER" },
    createInviteContext(),
    { repository, delivery },
  );

  const resent = await resendInviteUseCase(created.id, createInviteContext(), { repository, delivery });
  assert.equal(resent?.resendCount, 1);
  assert.equal(resent?.status, "SENT");
  const deliveries = await delivery.list();
  assert.equal(deliveries.length, 2);
});
