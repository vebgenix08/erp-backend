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
    githubRepositories: inputs.githubRepositories ?? ['vebgenix08/erp-backend', 'vebgenix08/erp-frontend'],
    githubEnvironments: inputs.githubEnvironments ?? ['development', 'staging', 'production'],
    cognitoDomainPrefix: inputs.cognitoDomainPrefix ?? 'erp-prod',
    apiName: 'api-prod',
    httpApiName: 'http-api-prod',
    restApiName: 'rest-api-prod',
    graphqlApiName: 'graphql-api-prod',
    apiStageName: 'prod',
    documentsBucketName: `${bucketPrefix}-documents-prod`,
    frontendBucketName: `${bucketPrefix}-frontend-prod`,
    eventBusName: 'events-prod',
    sesConfigurationSetName: 'erp-email-prod',
    emailEventsQueueName: 'email-events-prod',
    sesFromEmail: 'no-reply@vebgenix.com',
    sesFromName: 'Vebgenix ERP',
    sesVerifiedDomain: 'vebgenix.com',
    allowedOrigins: ['https://vebgenix.com', 'https://www.vebgenix.com'],
    lambdaNamePrefix: '',
    secretNames: {
      mongodb: 'mongodb-prod',
      razorpay: 'razorpay-prod',
      cognito: 'cognito-prod',
    },
    logRetentionDays: RetentionDays.ONE_MONTH,
    lambdaTimeout: Duration.seconds(10),
    lambdaMemorySize: 256,
    interactiveReservedConcurrency: 20,
    workerReservedConcurrency: 5,
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
