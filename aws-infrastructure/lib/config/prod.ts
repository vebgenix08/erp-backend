import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { EnvironmentConfig, EnvironmentInputs } from './types';

export function buildProdConfig(inputs: EnvironmentInputs): EnvironmentConfig {
  const bucketPrefix = inputs.bucketPrefix ?? inputs.accountId;
  return {
    environment: 'prod',
    accountId: inputs.accountId,
    region: inputs.region,
    bucketPrefix,
    githubRepository: inputs.githubRepository ?? '*/*',
    githubBranch: inputs.githubBranch ?? '*',
    cognitoDomainPrefix: inputs.cognitoDomainPrefix ?? 'erp-prod',
    apiName: 'api-prod',
    apiStageName: 'prod',
    documentsBucketName: `${bucketPrefix}-documents-prod`,
    eventBusName: 'events-prod',
    lambdaNamePrefix: '',
    secretNames: {
      mongodb: 'mongodb-prod',
      razorpay: 'razorpay-prod',
      cognito: 'cognito-prod',
    },
    logRetentionDays: RetentionDays.ONE_MONTH,
    lambdaTimeout: Duration.seconds(15),
    lambdaMemorySize: 256,
    removalPolicy: RemovalPolicy.RETAIN,
    cdkEnvironment: {
      account: inputs.accountId,
      region: inputs.region,
    },
    appConfig: {
      environment: 'prod',
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
