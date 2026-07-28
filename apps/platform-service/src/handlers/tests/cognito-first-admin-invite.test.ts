import assert from "node:assert/strict";
import test from "node:test";
import type { SESv2Client } from "@aws-sdk/client-sesv2";
import { assertSesRecipientEligible } from "../cognito-first-admin-invite";

function sesClient(responses: unknown[]): SESv2Client {
  return {
    async send() {
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
  } as unknown as SESv2Client;
}

test("allows all recipients after SES production access is enabled", async () => {
  await assertSesRecipientEligible(sesClient([{ ProductionAccessEnabled: true }]), "admin@example.com");
});

test("allows verified recipients while SES is sandboxed", async () => {
  await assertSesRecipientEligible(
    sesClient([{ ProductionAccessEnabled: false }, { VerifiedForSendingStatus: true, VerificationStatus: "SUCCESS" }]),
    "verified@example.com",
  );
});

test("rejects unverified recipients while SES is sandboxed", async () => {
  await assert.rejects(
    () => assertSesRecipientEligible(
      sesClient([{ ProductionAccessEnabled: false }, { VerifiedForSendingStatus: false, VerificationStatus: "PENDING" }]),
      "unverified@example.com",
    ),
    /SES sandbox cannot deliver to unverified recipient/,
  );
});
