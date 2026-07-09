import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { EnvironmentConfig, EnvironmentInputs } from './types';

export function buildDevConfig(inputs: EnvironmentInputs): EnvironmentConfig {
  const bucketPrefix = inputs.bucketPrefix ?? inputs.accountId;
  return {
    environment: 'dev',
    accountId: inputs.accountId,
    region: inputs.region,
    bucketPrefix,
    githubRepository: inputs.githubRepository ?? '*/*',
    githubBranch: inputs.githubBranch ?? '*',
    cognitoDomainPrefix: inputs.cognitoDomainPrefix ?? 'erp-dev',
    apiName: 'api-dev',
    apiStageName: 'dev',
    documentsBucketName: `${bucketPrefix}-documents-dev`,
    eventBusName: 'events-dev',
    lambdaNamePrefix: '',
    secretNames: {
      mongodb: 'mongodb-dev',
      razorpay: 'razorpay-dev',
      cognito: 'cognito-dev',
    },
    logRetentionDays: RetentionDays.ONE_WEEK,
    lambdaTimeout: Duration.seconds(10),
    lambdaMemorySize: 256,
    removalPolicy: RemovalPolicy.DESTROY,
    cdkEnvironment: {
      account: inputs.accountId,
      region: inputs.region,
    },
    appConfig: {
      environment: 'dev',
      services: [
        'platform-service',
        'identity-service',
        'admissions-service',
        'academics-service',
        'finance-service',
        'comms-service',
        'results-service',
        'storage-service',
      ],
    },
  };
}
