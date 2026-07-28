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
    githubRepositories: inputs.githubRepositories ?? ['vebgenix08/erp-backend', 'vebgenix08/erp-frontend'],
    githubEnvironments: inputs.githubEnvironments ?? ['development', 'staging', 'production'],
    cognitoDomainPrefix: inputs.cognitoDomainPrefix ?? 'erp-dev',
    apiName: 'api-dev',
    httpApiName: 'http-api-dev',
    restApiName: 'rest-api-dev',
    graphqlApiName: 'graphql-api-dev',
    apiStageName: 'dev',
    documentsBucketName: `${bucketPrefix}-documents-dev`,
    frontendBucketName: `${bucketPrefix}-frontend-dev`,
    eventBusName: 'events-dev',
    sesConfigurationSetName: 'erp-email-dev',
    emailEventsQueueName: 'email-events-dev',
    sesFromEmail: 'no-reply@sun-strom.in',
    sesFromName: 'ERP Development',
    sesVerifiedDomain: 'sun-strom.in',
    allowedOrigins: ['https://sun-strom.in', 'https://www.sun-strom.in', 'http://localhost:5173'],
    lambdaNamePrefix: '',
    secretNames: {
      mongodb: 'mongodb-dev',
      razorpay: 'razorpay-dev',
      cognito: 'cognito-dev',
    },
    logRetentionDays: RetentionDays.ONE_WEEK,
    lambdaTimeout: Duration.seconds(10),
    lambdaMemorySize: 256,
    interactiveReservedConcurrency: 8,
    workerReservedConcurrency: 2,
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
