import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryInviteEmailRepository } from "../invite-email.repository";
import { sendInviteEmailUseCase, getInviteEmailUseCase } from "../use-cases";
import { createInviteEmailContext } from "./fixtures";

test("get invite email returns the stored record", async () => {
  const repository = new InMemoryInviteEmailRepository();
  const created = await sendInviteEmailUseCase(
    {
      inviteId: "invite_1",
      tenantId: "tenant_test_1",
      email: "beta@example.test",
      role: "TEACHER",
      inviteUrl: "https://app.example.test/accept-invite?token=y",
      subject: "Invitation",
      text: "text",
      html: "<p>html</p>",
    },
    createInviteEmailContext(),
    { repository, provider: { send: async () => ({ messageId: "ses-message-get" }) } },
  );

  const result = await getInviteEmailUseCase(created.id, createInviteEmailContext(), { repository });
  assert.equal(result?.id, created.id);
  assert.equal(result?.messageId, created.messageId);
});
