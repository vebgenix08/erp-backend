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
    { repository, provider: { send: async () => ({ messageId: "ses-message-1" }) } },
  );

  assert.equal(result.status, "SENT");
  assert.equal(result.email, "teacher@example.test");
  assert.equal(result.messageId, "ses-message-1");
});

test("send invite email persists provider failure instead of a synthetic SENT state", async () => {
  const repository = new InMemoryInviteEmailRepository();
  await assert.rejects(() => sendInviteEmailUseCase({ inviteId: "invite_2", tenantId: "tenant_test_1", email: "teacher@example.test", role: "TEACHER", inviteUrl: "https://app.example.test/invite", subject: "Invitation", text: "text", html: "<p>html</p>" }, createInviteEmailContext(), { repository, provider: { send: async () => { throw new Error("SES rejected message"); } } }));
  const records = await repository.list("tenant_test_1");
  assert.equal(records[0]?.status, "FAILED");
  assert.equal(records[0]?.errorMessage, "SES rejected message");
});
