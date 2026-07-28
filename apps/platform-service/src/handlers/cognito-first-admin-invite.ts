import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { GetAccountCommand, GetEmailIdentityCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { FirstAdminInvitePort } from "../modules/bootstrap/bootstrap.service";

interface InviteEnvironment { COGNITO_USER_POOL_ID?: string; DEPLOY_REGION?: string }

export async function assertSesRecipientEligible(client: SESv2Client, email: string): Promise<void> {
  const account = await client.send(new GetAccountCommand({}));
  if (account.ProductionAccessEnabled) return;

  let verified = false;
  try {
    const identity = await client.send(new GetEmailIdentityCommand({ EmailIdentity: email }));
    verified = identity.VerifiedForSendingStatus === true && identity.VerificationStatus === "SUCCESS";
  } catch {
    verified = false;
  }
  if (!verified) {
    throw new Error(`SES sandbox cannot deliver to unverified recipient ${email}`);
  }
}

function runtimeEnvironment(): InviteEnvironment {
  return (globalThis as unknown as { process?: { env?: InviteEnvironment } }).process?.env ?? {};
}

export function createCognitoFirstAdminInvitePort(env: InviteEnvironment = runtimeEnvironment()): FirstAdminInvitePort {
  const userPoolId = env.COGNITO_USER_POOL_ID?.trim();
  if (!userPoolId) throw new Error("COGNITO_USER_POOL_ID is required for first-admin invites");
  const client = new CognitoIdentityProviderClient(env.DEPLOY_REGION ? { region: env.DEPLOY_REGION } : {});
  const sesClient = new SESv2Client(env.DEPLOY_REGION ? { region: env.DEPLOY_REGION } : {});
  return {
    async sendFirstAdminInvite(input) {
      await assertSesRecipientEligible(sesClient, input.adminEmail);
      const created = await client.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: input.adminEmail,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
          { Name: "email", Value: input.adminEmail },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: input.adminName },
          { Name: "custom:tenantId", Value: input.tenantId },
          { Name: "custom:role", Value: input.roleCode },
        ],
        ClientMetadata: { tenantId: input.tenantId, roleCode: input.roleCode },
      }));
      try {
        await client.send(new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: input.adminEmail,
          GroupName: "TENANT_ADMIN",
        }));
      } catch (error) {
        await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: input.adminEmail })).catch(() => undefined);
        throw error;
      }
      return { inviteId: created.User?.Username ?? input.adminEmail, sentAt: new Date() };
    },
    async resendFirstAdminInvite(input) {
      await assertSesRecipientEligible(sesClient, input.adminEmail);
      const resent = await client.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: input.adminEmail,
        MessageAction: "RESEND",
        DesiredDeliveryMediums: ["EMAIL"],
        ClientMetadata: { tenantId: input.tenantId, roleCode: input.roleCode },
      }));
      await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: input.adminEmail, GroupName: "TENANT_ADMIN" }));
      return { inviteId: resent.User?.Username ?? input.adminEmail, sentAt: new Date() };
    },
  };
}
