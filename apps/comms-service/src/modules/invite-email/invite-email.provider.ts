import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { InviteEmailCreateInput } from "./invite-email.model";

export interface InviteEmailProviderResult { messageId: string }
export interface InviteEmailProvider { send(input: InviteEmailCreateInput): Promise<InviteEmailProviderResult> }

export class SesInviteEmailProvider implements InviteEmailProvider {
  private readonly client: SESv2Client;
  constructor(private readonly fromEmail: string, private readonly configurationSetName?: string, client?: SESv2Client) {
    this.client = client ?? new SESv2Client({});
  }
  async send(input: InviteEmailCreateInput): Promise<InviteEmailProviderResult> {
    const response = await this.client.send(new SendEmailCommand({
      FromEmailAddress: this.fromEmail,
      Destination: { ToAddresses: [input.email] },
      Content: { Simple: { Subject: { Data: input.subject, Charset: "UTF-8" }, Body: { Text: { Data: input.text, Charset: "UTF-8" }, Html: { Data: input.html, Charset: "UTF-8" } } } },
      ConfigurationSetName: this.configurationSetName,
      EmailTags: [{ Name: "tenantId", Value: input.tenantId }, { Name: "inviteId", Value: input.inviteId }],
    }));
    if (!response.MessageId) throw new Error("SES did not return a message id");
    return { messageId: response.MessageId };
  }
}

function runtimeEnvironment(): Record<string, string | undefined> {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

export function createRuntimeInviteEmailProvider(env: Record<string, string | undefined> = runtimeEnvironment()): InviteEmailProvider {
  const fromEmail = env.SES_FROM_EMAIL?.trim();
  if (!fromEmail) throw new Error("SES_FROM_EMAIL is required");
  return new SesInviteEmailProvider(fromEmail, env.SES_CONFIGURATION_SET_NAME?.trim() || undefined);
}
