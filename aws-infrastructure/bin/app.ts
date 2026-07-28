import { App } from 'aws-cdk-lib';
import { loadInfrastructureConfig } from '../lib/config';
import { GithubOidcRoleStack } from '../lib/stacks/github-oidc-role-stack';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { EventBridgeStack } from '../lib/stacks/eventbridge-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { LambdaServicesStack } from '../lib/stacks/lambda-services-stack';
import { AppSyncStack } from '../lib/stacks/appsync-stack';
import { ApiGatewayHttpStack } from '../lib/stacks/api-gateway-http-stack';
import { ApiGatewayRestStack } from '../lib/stacks/api-gateway-rest-stack';
import { FrontendHostingStack } from '../lib/stacks/frontend-hosting-stack';
import { EmailEventsStack } from '../lib/stacks/email-events-stack';

const app = new App();
const config = loadInfrastructureConfig({ environment: app.node.tryGetContext('environment') });

const frontendStack = new FrontendHostingStack(app, `frontend-hosting-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});
const runtimeConfig = {
  ...config,
  allowedOrigins: [...config.allowedOrigins, `https://${frontendStack.distribution.distributionDomainName}`],
};

const githubOidcRoleStack = new GithubOidcRoleStack(app, `github-oidc-role-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const storageStack = new StorageStack(app, `storage-${config.environment}`, {
  env: config.cdkEnvironment,
  config: runtimeConfig,
});

const eventBridgeStack = new EventBridgeStack(app, `events-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const emailEventsStack = new EmailEventsStack(app, `email-events-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const secretsStack = new SecretsStack(app, `secrets-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

const cognitoStack = new CognitoStack(app, `cognito-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
  mongodbSecretArn: secretsStack.mongodbSecret.attrId,
});
cognitoStack.addDependency(secretsStack);

const lambdaServicesStack = new LambdaServicesStack(app, `lambda-services-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
  documentsBucketName: storageStack.documentsBucket.bucketName,
  eventBusName: eventBridgeStack.bus.eventBusName,
  cognitoUserPoolId: cognitoStack.userPoolId,
  cognitoUserPoolClientId: cognitoStack.userPoolClientId,
  secretNames: config.secretNames,
  mongodbSecretArn: secretsStack.mongodbSecret.attrId,
  emailEventsQueue: emailEventsStack.eventQueue,
});

new AppSyncStack(app, `appsync-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
  userPoolId: cognitoStack.userPoolId,
  platformGraphqlFunction: lambdaServicesStack.platformGraphqlFunction,
  identityGraphqlFunction: lambdaServicesStack.identityGraphqlFunction,
  settingsGraphqlFunction: lambdaServicesStack.settingsGraphqlFunction,
  academicsGraphqlFunction: lambdaServicesStack.academicsGraphqlFunction,
  admissionsGraphqlFunction: lambdaServicesStack.admissionsGraphqlFunction,
  financeGraphqlFunction: lambdaServicesStack.financeGraphqlFunction,
  commsGraphqlFunction: lambdaServicesStack.commsGraphqlFunction,
});

new ApiGatewayHttpStack(app, `http-api-${config.environment}`, {
  env: config.cdkEnvironment,
  config: runtimeConfig,
  healthFunctions: lambdaServicesStack.services,
  storageFunction: lambdaServicesStack.storageOperationalFunction,
  financeReceiptFunction: lambdaServicesStack.financeReceiptFunction,
  academicsDocumentFunction: lambdaServicesStack.academicsDocumentFunction,
  cognitoUserPoolId: cognitoStack.userPoolId,
  cognitoUserPoolClientId: cognitoStack.userPoolClientId,
});

new ApiGatewayRestStack(app, `rest-api-${config.environment}`, {
  env: config.cdkEnvironment,
  config,
});

githubOidcRoleStack.addDependency(secretsStack);
lambdaServicesStack.addDependency(storageStack);
lambdaServicesStack.addDependency(eventBridgeStack);
lambdaServicesStack.addDependency(cognitoStack);
lambdaServicesStack.addDependency(secretsStack);
lambdaServicesStack.addDependency(emailEventsStack);
