import type { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { RetentionDays } from 'aws-cdk-lib/aws-logs';

export type EnvironmentName = 'dev' | 'prod';

export interface EnvironmentInputs {
  environment: EnvironmentName;
  accountId: string;
  region: string;
  bucketPrefix?: string;
  githubRepository?: string;
  githubBranch?: string;
  cognitoDomainPrefix?: string;
}

export interface EnvironmentConfig {
  environment: EnvironmentName;
  accountId: string;
  region: string;
  bucketPrefix: string;
  githubRepository: string;
  githubBranch: string;
  cognitoDomainPrefix: string;
  apiName: string;
  apiStageName: string;
  documentsBucketName: string;
  eventBusName: string;
  lambdaNamePrefix: string;
  secretNames: {
    mongodb: string;
    razorpay: string;
    cognito: string;
  };
  logRetentionDays: RetentionDays;
  lambdaTimeout: Duration;
  lambdaMemorySize: number;
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
