import * as path from 'path';
import { CfnOutput, Stack, StackProps, aws_cognito as cognito, aws_lambda as lambda, aws_logs as logs, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import { CognitoUserPool } from '../constructs/cognito-user-pool';

export interface CognitoStackProps extends StackProps {
  config: EnvironmentConfig;
  mongodbSecretArn: string;
}

export class CognitoStack extends Stack {
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const userPoolConstruct = new CognitoUserPool(this, 'CognitoUserPool', { config: props.config });
    this.userPoolId = userPoolConstruct.userPool.userPoolId;
    this.userPoolClientId = userPoolConstruct.userPoolClient.userPoolClientId;

    const postAuthentication = new NodejsFunction(this, 'PostAuthenticationFunction', {
      functionName: `auth-lifecycle-${props.config.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'workers', 'cognito-sync', 'src', 'index.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      timeout: props.config.lambdaTimeout,
      memorySize: props.config.lambdaMemorySize,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'cognito-sync',
        MONGODB_SECRET_NAME: props.config.secretNames.mongodb,
      },
    });
    secretsmanager.Secret.fromSecretCompleteArn(this, 'MongoDbSecretReference', props.mongodbSecretArn).grantRead(postAuthentication);
    userPoolConstruct.userPool.addTrigger(cognito.UserPoolOperation.POST_AUTHENTICATION, postAuthentication);
    new logs.LogRetention(this, 'PostAuthenticationLogRetention', {
      logGroupName: `/aws/lambda/${postAuthentication.functionName}`,
      retention: props.config.logRetentionDays,
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId });
  }
}
