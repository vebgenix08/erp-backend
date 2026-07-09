import { CfnOutput, Stack, StackProps, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';

export interface SecretsStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class SecretsStack extends Stack {
  public readonly mongodbSecret: secretsmanager.CfnSecret;
  public readonly razorpaySecret: secretsmanager.CfnSecret;
  public readonly cognitoSecret: secretsmanager.CfnSecret;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    this.mongodbSecret = new secretsmanager.CfnSecret(this, 'MongoDbSecret', {
      name: props.config.secretNames.mongodb,
      description: 'Placeholder secret for MongoDB connection details',
    });

    this.razorpaySecret = new secretsmanager.CfnSecret(this, 'RazorpaySecret', {
      name: props.config.secretNames.razorpay,
      description: 'Placeholder secret for Razorpay credentials',
    });

    this.cognitoSecret = new secretsmanager.CfnSecret(this, 'CognitoSecret', {
      name: props.config.secretNames.cognito,
      description: 'Placeholder secret for Cognito integration values',
    });

    new CfnOutput(this, 'MongoDbSecretName', { value: props.config.secretNames.mongodb });
    new CfnOutput(this, 'RazorpaySecretName', { value: props.config.secretNames.razorpay });
    new CfnOutput(this, 'CognitoSecretName', { value: props.config.secretNames.cognito });
  }
}
