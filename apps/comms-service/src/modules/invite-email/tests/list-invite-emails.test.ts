import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryInviteEmailRepository } from "../invite-email.repository";
import { sendInviteEmailUseCase, listInviteEmailsUseCase } from "../use-cases";
import { createInviteEmailContext } from "./fixtures";

test("list invite emails returns tenant scoped records", async () => {
  const repository = new InMemoryInviteEmailRepository();
  await sendInviteEmailUseCase(
    {
      inviteId: "invite_1",
      tenantId: "tenant_test_1",
      email: "alpha@example.test",
      role: "TEACHER",
      inviteUrl: "https://app.example.test/accept-invite?token=x",
      subject: "Invitation",
      text: "text",
      html: "<p>html</p>",
    },
    createInviteEmailContext(),
    { repository, provider: { send: async () => ({ messageId: "ses-message-list" }) } },
  );

  const result = await listInviteEmailsUseCase(createInviteEmailContext(), { repository }, { search: "alpha" });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.email, "alpha@example.test");
});
