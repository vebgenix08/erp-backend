import { App } from 'aws-cdk-lib';
import { loadInfrastructureConfig } from '../lib/config';
import { GithubOidcRoleStack } from '../lib/stacks/github-oidc-role-stack';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { EventBridgeStack } from '../lib/stacks/eventbridge-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { LambdaServicesStack } from '../lib/stacks/lambda-services-stack';
import { ApiGatewayStack } from '../lib/stacks/api-gateway-stack';

const app = new App();
const config = loadInfrastructureConfig();

const githubOidcRoleStack = new GithubOidcRoleStack(app, `github-oidc-role-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const cognitoStack = new CognitoStack(app, `cognito-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const storageStack = new StorageStack(app, `storage-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const eventBridgeStack = new EventBridgeStack(app, `events-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const secretsStack = new SecretsStack(app, `secrets-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const lambdaServicesStack = new LambdaServicesStack(app, `lambda-services-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
  documentsBucketName: storageStack.documentsBucket.bucketName,
  eventBusName: eventBridgeStack.bus.eventBusName,
  cognitoUserPoolId: cognitoStack.userPoolId,
  cognitoUserPoolClientId: cognitoStack.userPoolClientId,
  secretNames: config.secretNames,
});

new ApiGatewayStack(app, `api-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
  healthFunctions: lambdaServicesStack.services,
});

githubOidcRoleStack.addDependency(secretsStack);
lambdaServicesStack.addDependency(storageStack);
lambdaServicesStack.addDependency(eventBridgeStack);
lambdaServicesStack.addDependency(cognitoStack);
lambdaServicesStack.addDependency(secretsStack);
