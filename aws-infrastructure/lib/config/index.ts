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

export interface InfrastructureConfigOverrides {
  environment?: unknown;
}

export function loadInfrastructureConfig(overrides: InfrastructureConfigOverrides = {}): EnvironmentConfig {
  const requestedEnvironment =
    typeof overrides.environment === 'string' && overrides.environment.trim()
      ? overrides.environment.trim()
      : requiredEnv('environment');
  const environment = requestedEnvironment.toLowerCase() as EnvironmentName;
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
    ...(process.env.GITHUB_REPOSITORIES?.trim()
      ? { githubRepositories: process.env.GITHUB_REPOSITORIES.split(',').map((value) => value.trim()).filter(Boolean) }
      : {}),
    ...(process.env.GITHUB_ENVIRONMENTS?.trim()
      ? { githubEnvironments: process.env.GITHUB_ENVIRONMENTS.split(',').map((value) => value.trim()).filter(Boolean) }
      : {}),
    ...(process.env.COGNITO_DOMAIN_PREFIX?.trim() ? { cognitoDomainPrefix: process.env.COGNITO_DOMAIN_PREFIX.trim() } : {}),
  };

  return environment === 'dev' ? buildDevConfig(inputs) : buildProdConfig(inputs);
}
