import type { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { RetentionDays } from 'aws-cdk-lib/aws-logs';

export type EnvironmentName = 'dev' | 'prod';

export interface EnvironmentInputs {
  environment: EnvironmentName;
  accountId: string;
  region: string;
  bucketPrefix?: string;
  githubRepositories?: string[];
  githubEnvironments?: string[];
  cognitoDomainPrefix?: string;
}

export interface EnvironmentConfig {
  environment: EnvironmentName;
  accountId: string;
  region: string;
  bucketPrefix: string;
  githubRepositories: string[];
  githubEnvironments: string[];
  cognitoDomainPrefix: string;
  apiName: string;
  httpApiName: string;
  restApiName: string;
  graphqlApiName: string;
  apiStageName: string;
  documentsBucketName: string;
  frontendBucketName: string;
  eventBusName: string;
  sesConfigurationSetName: string;
  emailEventsQueueName: string;
  sesFromEmail: string;
  sesFromName: string;
  sesVerifiedDomain: string;
  allowedOrigins: string[];
  lambdaNamePrefix: string;
  secretNames: {
    mongodb: string;
    razorpay: string;
    cognito: string;
  };
  logRetentionDays: RetentionDays;
  lambdaTimeout: Duration;
  lambdaMemorySize: number;
  interactiveReservedConcurrency: number;
  workerReservedConcurrency: number;
  removalPolicy: RemovalPolicy;
  cdkEnvironment: {
    account: string;
    region: string;
  };
  appConfig: {
    environment: EnvironmentName;
    services: readonly string[];
  };
}
