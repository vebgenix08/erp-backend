import * as path from 'path';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';

export interface ServiceLambdaProps {
  serviceName: string;
  config: EnvironmentConfig;
  environmentVariables?: Record<string, string>;
}

export class ServiceLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: ServiceLambdaProps) {
    super(scope, id);

    const functionName = `${props.serviceName}-${props.config.environment}`;

    this.function = new NodejsFunction(this, 'Function', {
      functionName,
      description: `Health handler for ${props.serviceName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.resolve(process.cwd(), 'runtime', 'health', 'index.ts'),
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: props.serviceName,
        AWS_ACCOUNT_ID: props.config.accountId,
        DEPLOY_REGION: props.config.region,
        ...props.environmentVariables,
      },
    });
  }
}
