import type { EnvironmentConfig, EnvironmentInputs, EnvironmentName } from './types';
import { buildDevConfig } from './dev';
import { buildProdConfig } from './prod';

export type { EnvironmentConfig, EnvironmentInputs, EnvironmentName } from './types';

export function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`);
}

export function loadInfrastructureConfig(): EnvironmentConfig {
  const environment = (requiredEnv('environment') as EnvironmentName).toLowerCase() as EnvironmentName;
  if (environment !== 'dev' && environment !== 'prod') {
    throw new Error(`Invalid environment "${environment}". Allowed values: dev, prod`);
  }

  const accountId = requiredEnv('AWS_ACCOUNT_ID', 'CDK_DEFAULT_ACCOUNT');
  const region = requiredEnv('AWS_REGION', 'CDK_DEFAULT_REGION');
  const inputs: EnvironmentInputs = {
    environment,
    accountId,
    region,
    ...(process.env.S3_BUCKET_PREFIX?.trim() ? { bucketPrefix: process.env.S3_BUCKET_PREFIX.trim() } : {}),
    ...(process.env.GITHUB_REPOSITORY?.trim() ? { githubRepository: process.env.GITHUB_REPOSITORY.trim() } : {}),
    ...(process.env.GITHUB_BRANCH?.trim() ? { githubBranch: process.env.GITHUB_BRANCH.trim() } : {}),
    ...(process.env.COGNITO_DOMAIN_PREFIX?.trim() ? { cognitoDomainPrefix: process.env.COGNITO_DOMAIN_PREFIX.trim() } : {}),
  };

  return environment === 'dev' ? buildDevConfig(inputs) : buildProdConfig(inputs);
}
