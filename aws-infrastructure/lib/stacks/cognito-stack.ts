import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import { CognitoUserPool } from '../constructs/cognito-user-pool';

export interface CognitoStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class CognitoStack extends Stack {
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const cognito = new CognitoUserPool(this, 'CognitoUserPool', { config: props.config });
    this.userPoolId = cognito.userPool.userPoolId;
    this.userPoolClientId = cognito.userPoolClient.userPoolClientId;

    new CfnOutput(this, 'UserPoolId', { value: this.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClientId });
  }
}
