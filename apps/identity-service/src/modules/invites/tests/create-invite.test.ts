import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryInviteDelivery } from "@school-erp/comms";
import { InMemoryInviteRepository } from "../invites.repository";
import { createInviteUseCase } from "../use-cases";
import { createInviteContext } from "./fixtures";

test("create invite stores the record and sends email", async () => {
  const repository = new InMemoryInviteRepository();
  const delivery = createInMemoryInviteDelivery();
  const result = await createInviteUseCase(
    {
      email: "teacher@example.test",
      role: "TEACHER",
      fullName: "Test Teacher",
      expiresInDays: 10,
    },
    createInviteContext(),
    { repository, delivery, baseUrl: "https://app.example.test" },
  );

  assert.equal(result.email, "teacher@example.test");
  assert.equal(result.status, "SENT");
  assert.equal(result.deliveryStatus, "SENT");
  assert.equal(result.resendCount, 0);
  assert.match(result.inviteUrl, /^https:\/\/app\.example\.test\/accept-invite\?/);
});
