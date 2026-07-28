import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryInviteEmailRepository } from "../invite-email.repository";
import { sendInviteEmailUseCase } from "../use-cases";
import { createInviteEmailContext } from "./fixtures";

test("send invite email stores a delivery record", async () => {
  const repository = new InMemoryInviteEmailRepository();
  const result = await sendInviteEmailUseCase(
    {
      inviteId: "invite_1",
      tenantId: "tenant_test_1",
      email: "teacher@example.test",
      role: "TEACHER",
      inviteUrl: "https://app.example.test/accept-invite?token=x",
      subject: "Invitation",
      text: "text",
      html: "<p>html</p>",
    },
    createInviteEmailContext(),
    { repository },
  );

  assert.equal(result.status, "SENT");
  assert.equal(result.email, "teacher@example.test");
});
