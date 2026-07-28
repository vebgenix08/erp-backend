import { Duration, RemovalPolicy, aws_cognito as cognito } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';

export interface CognitoUserPoolProps {
  config: EnvironmentConfig;
}

export class CognitoUserPool extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoUserPoolProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `userpool-${props.config.environment}`,
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: cognito.UserPoolEmail.withSES({
        fromEmail: props.config.sesFromEmail,
        fromName: props.config.sesFromName,
        sesRegion: props.config.region,
        sesVerifiedDomain: props.config.sesVerifiedDomain,
        configurationSetName: props.config.sesConfigurationSetName,
      }),
      customAttributes: {
        tenantId: new cognito.StringAttribute({ minLen: 1, maxLen: 128, mutable: true }),
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 64, mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: false,
        requireUppercase: true,
      },
      removalPolicy: props.config.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `app-client-${props.config.environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },
      generateSecret: false,
      accessTokenValidity: Duration.hours(8),
      idTokenValidity: Duration.hours(8),
      refreshTokenValidity: Duration.days(30),
    });

    new cognito.CfnUserPoolGroup(this, 'TenantAdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'TENANT_ADMIN',
      description: 'Tenant administrators',
    });
  }
}
