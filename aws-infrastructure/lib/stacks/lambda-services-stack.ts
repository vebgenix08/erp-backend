import { CfnOutput, Stack, StackProps, aws_apigateway as apigateway, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import { ServiceLambda } from '../constructs/service-lambda';

const SERVICE_NAMES = [
  'platform-service',
  'identity-service',
  'admissions-service',
  'academics-service',
  'finance-service',
  'comms-service',
  'results-service',
  'storage-service',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface LambdaServicesStackProps extends StackProps {
  config: EnvironmentConfig;
  documentsBucketName: string;
  eventBusName: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  secretNames: {
    mongodb: string;
    razorpay: string;
    cognito: string;
  };
}

export class LambdaServicesStack extends Stack {
  public readonly services: Record<ServiceName, lambda.Function>;

  constructor(scope: Construct, id: string, props: LambdaServicesStackProps) {
    super(scope, id, props);

    this.services = Object.fromEntries(
      SERVICE_NAMES.map((serviceName) => {
        const service = new ServiceLambda(this, `${serviceName}Lambda`, {
          serviceName,
          config: props.config,
          environmentVariables: {
            DOCUMENTS_BUCKET_NAME: props.documentsBucketName,
            EVENT_BUS_NAME: props.eventBusName,
            COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
            COGNITO_USER_POOL_CLIENT_ID: props.cognitoUserPoolClientId,
            MONGODB_SECRET_NAME: props.secretNames.mongodb,
            RAZORPAY_SECRET_NAME: props.secretNames.razorpay,
            COGNITO_SECRET_NAME: props.secretNames.cognito,
          },
        });

        new logs.LogRetention(this, `${serviceName}LogRetention`, {
          logGroupName: `/aws/lambda/${service.function.functionName}`,
          retention: props.config.logRetentionDays,
        });

        new CfnOutput(this, `${serviceName}FunctionName`, {
          value: service.function.functionName,
        });
        return [serviceName, service.function];
      }),
    ) as Record<ServiceName, lambda.Function>;
  }

  public getFunction(serviceName: ServiceName): lambda.Function {
    return this.services[serviceName];
  }
}
