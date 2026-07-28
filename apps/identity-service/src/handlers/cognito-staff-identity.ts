import type { StaffIdentityGateway } from "../modules/employees/employees.model";

export class CognitoStaffIdentityGateway implements StaffIdentityGateway {
  constructor(private readonly userPoolId: string, private readonly region?: string) {}

  private async client() {
    const { CognitoIdentityProviderClient } = await import("@aws-sdk/client-cognito-identity-provider");
    return new CognitoIdentityProviderClient(this.region ? { region: this.region } : {});
  }

  async invite(input: { email: string; fullName: string; tenantId: string; roleCode: string }) {
    const { AdminCreateUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const result = await (await this.client()).send(new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: input.email,
      DesiredDeliveryMediums: ["EMAIL"],
      UserAttributes: [
        { Name: "email", Value: input.email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: input.fullName },
        { Name: "custom:tenantId", Value: input.tenantId },
        { Name: "custom:role", Value: input.roleCode },
      ],
    }));
    const username = result.User?.Username ?? input.email;
    const subject = result.User?.Attributes?.find((item) => item.Name === "sub")?.Value;
    return { username, ...(subject ? { subject } : {}) };
  }

  async resend(email: string) {
    const { AdminCreateUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    await (await this.client()).send(new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      MessageAction: "RESEND",
      DesiredDeliveryMediums: ["EMAIL"],
    }));
  }

  async get(email: string) {
    const { AdminGetUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    const result = await (await this.client()).send(new AdminGetUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    }));
    const attribute = (name: string) => result.UserAttributes?.find((item) => item.Name === name)?.Value;
    const username = result.Username ?? email;
    const subject = attribute("sub");
    const tenantId = attribute("custom:tenantId");
    const roleCode = attribute("custom:role");
    return {
      username,
      ...(subject ? { subject } : {}),
      ...(tenantId ? { tenantId } : {}),
      ...(roleCode ? { roleCode } : {}),
    };
  }

  async disable(email: string) {
    const { AdminDisableUserCommand } = await import("@aws-sdk/client-cognito-identity-provider");
    await (await this.client()).send(new AdminDisableUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
    }));
  }
}
