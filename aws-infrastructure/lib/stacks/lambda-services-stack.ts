import * as path from 'path';
import { CfnOutput, Duration, Stack, StackProps, aws_cloudwatch as cloudwatch, aws_events as events, aws_events_targets as eventTargets, aws_iam as iam, aws_lambda as lambda, aws_logs as logs, aws_secretsmanager as secretsmanager, aws_sqs as sqs, aws_lambda_event_sources as eventSources, aws_stepfunctions as sfn, aws_stepfunctions_tasks as tasks } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import { ServiceLambda } from '../constructs/service-lambda';

const SERVICE_NAMES = [
  'platform-service',
  'identity-service',
  'settings-service',
  'admissions-service',
  'academics-service',
  'finance-service',
  'comms-service',
  'results-service',
  'storage-service',
] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface LambdaServicesStackProps extends StackProps {
  config: EnvironmentConfig;
  documentsBucketName: string;
  eventBusName: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  secretNames: {
    mongodb: string;
    razorpay: string;
    cognito: string;
  };
  mongodbSecretArn: string;
  emailEventsQueue: sqs.IQueue;
}

export class LambdaServicesStack extends Stack {
  public readonly services: Record<ServiceName, lambda.Function>;
  public readonly platformGraphqlFunction: lambda.Function;
  public readonly identityGraphqlFunction: lambda.Function;
  public readonly settingsGraphqlFunction: lambda.Function;
  public readonly academicsGraphqlFunction: lambda.Function;
  public readonly admissionsGraphqlFunction: lambda.Function;
  public readonly financeGraphqlFunction: lambda.Function;
  public readonly financeReceiptFunction: lambda.Function;
  public readonly academicsDocumentFunction: lambda.Function;
  public readonly commsGraphqlFunction: lambda.Function;
  public readonly storageOperationalFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaServicesStackProps) {
    super(scope, id, props);

    this.services = Object.fromEntries(
      SERVICE_NAMES.map((serviceName) => {
        const service = new ServiceLambda(this, `${serviceName}Lambda`, {
          serviceName,
          config: props.config,
          environmentVariables: {
            DOCUMENTS_BUCKET_NAME: props.documentsBucketName,
            EVENT_BUS_NAME: props.eventBusName,
            COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
            COGNITO_USER_POOL_CLIENT_ID: props.cognitoUserPoolClientId,
            MONGODB_SECRET_NAME: props.secretNames.mongodb,
            RAZORPAY_SECRET_NAME: props.secretNames.razorpay,
            COGNITO_SECRET_NAME: props.secretNames.cognito,
          },
        });

        new logs.LogRetention(this, `${serviceName}LogRetention`, {
          logGroupName: `/aws/lambda/${service.function.functionName}`,
          retention: props.config.logRetentionDays,
        });

        new CfnOutput(this, `${serviceName}FunctionName`, {
          value: service.function.functionName,
        });
        return [serviceName, service.function];
      }),
    ) as Record<ServiceName, lambda.Function>;

    this.storageOperationalFunction = new NodejsFunction(this, 'StorageOperationalFunction', {
      functionName: `storage-service-files-${props.config.environment}`,
      description: 'Authenticated file metadata and signed S3 URL operations',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'storage-service', 'src', 'handlers', 'lambda.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: {
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/s3-request-presigner',
          '@aws-sdk/client-secrets-manager',
        ],
      },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'storage-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
        DOCUMENTS_BUCKET_NAME: props.documentsBucketName,
      },
    });
    secretsmanager.Secret.fromSecretCompleteArn(this, 'StorageFilesMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.storageOperationalFunction);
    this.storageOperationalFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::${props.documentsBucketName}/*`],
    }));
    new logs.LogRetention(this, 'StorageFilesLogRetention', {
      logGroupName: `/aws/lambda/${this.storageOperationalFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });

    this.platformGraphqlFunction = new NodejsFunction(this, 'PlatformGraphqlFunction', {
      functionName: `platform-service-graphql-${props.config.environment}`,
      description: 'AppSync adapter for platform-service use-cases',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'platform-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: {
        externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-cognito-identity-provider'],
      },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'platform-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
        DEPLOY_REGION: props.config.region,
      },
    });
    this.identityGraphqlFunction = new NodejsFunction(this, 'IdentityGraphqlFunction', {
      functionName: `identity-service-graphql-${props.config.environment}`,
      description: 'AppSync adapter for identity-service use-cases',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'identity-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-cognito-identity-provider'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'identity-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
      },
    });
    this.settingsGraphqlFunction = new NodejsFunction(this, 'SettingsGraphqlFunction', {
      functionName: `settings-service-graphql-${props.config.environment}`,
      description: 'AppSync adapter for tenant settings use-cases',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'settings-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'settings-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
      },
    });
    this.academicsGraphqlFunction = new NodejsFunction(this, 'AcademicsGraphqlFunction', {
      functionName: `academics-service-graphql-${props.config.environment}`,
      description: 'AppSync adapter for academics-service use-cases',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'academics-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-eventbridge', '@aws-sdk/client-sfn'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'academics-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
        IDENTITY_MONGODB_DB_NAME: `identity-service_${props.config.environment}`,
        SETTINGS_MONGODB_DB_NAME: `settings-service_${props.config.environment}`,
        EVENT_BUS_NAME: props.eventBusName,
      },
    });
    this.admissionsGraphqlFunction = new NodejsFunction(this, 'AdmissionsGraphqlFunction', {
      functionName: `admissions-service-graphql-${props.config.environment}`,
      description: 'AppSync adapter for admissions-service use-cases',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'admissions-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-eventbridge'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'admissions-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
        SETTINGS_MONGODB_DB_NAME: `settings-service_${props.config.environment}`,
        EVENT_BUS_NAME: props.eventBusName,
      },
    });
    this.financeGraphqlFunction = new NodejsFunction(this, 'FinanceGraphqlFunction', {
      functionName: `finance-service-graphql-${props.config.environment}`,
      description: 'AppSync adapter for finance-service use-cases',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'finance-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: Math.max(props.config.lambdaMemorySize, 512),
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-s3'] },
      environment: { environment: props.config.environment, SERVICE_NAME: 'finance-service', MONGODB_SECRET_NAME: props.secretNames.mongodb, DOCUMENTS_BUCKET_NAME: props.documentsBucketName },
    });
    this.financeReceiptFunction = new NodejsFunction(this, 'FinanceReceiptFunction', {
      functionName: `finance-service-receipts-${props.config.environment}`,
      description: 'Authenticated on-demand finance receipt PDF generation',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'finance-service', 'src', 'handlers', 'receipt-pdf.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: Math.max(props.config.lambdaMemorySize, 512),
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-s3'] },
      environment: { environment: props.config.environment, SERVICE_NAME: 'finance-service', MONGODB_SECRET_NAME: props.secretNames.mongodb, DOCUMENTS_BUCKET_NAME: props.documentsBucketName },
    });
    this.academicsDocumentFunction = new NodejsFunction(this, 'AcademicsDocumentFunction', {
      functionName: `academics-service-documents-${props.config.environment}`,
      description: 'Authenticated certificate and student ID PDF generation',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'academics-service', 'src', 'handlers', 'student-document-pdf.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: Math.max(props.config.lambdaMemorySize, 512),
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-s3'] },
      environment: { environment: props.config.environment, SERVICE_NAME: 'academics-service', MONGODB_SECRET_NAME: props.secretNames.mongodb, DOCUMENTS_BUCKET_NAME: props.documentsBucketName },
    });
    this.commsGraphqlFunction = new NodejsFunction(this, 'CommsGraphqlFunction', {
      functionName: `comms-service-graphql-${props.config.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'comms-service', 'src', 'handlers', 'graphql.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-sesv2'] },
      environment: { environment: props.config.environment, SERVICE_NAME: 'comms-service', MONGODB_SECRET_NAME: props.secretNames.mongodb, SES_FROM_EMAIL: props.config.sesFromEmail, SES_CONFIGURATION_SET_NAME: props.config.sesConfigurationSetName },
    });
    secretsmanager.Secret.fromSecretCompleteArn(this, 'CommsGraphqlMongoSecretReference', props.mongodbSecretArn).grantRead(this.commsGraphqlFunction);
    this.commsGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ['ses:SendEmail'], resources: ['*'] }));
    new logs.LogRetention(this, 'CommsGraphqlLogRetention', { logGroupName: `/aws/lambda/${this.commsGraphqlFunction.functionName}`, retention: props.config.logRetentionDays });

    const interactiveFunctions = [
      this.platformGraphqlFunction,
      this.identityGraphqlFunction,
      this.settingsGraphqlFunction,
      this.academicsGraphqlFunction,
      this.admissionsGraphqlFunction,
      this.financeGraphqlFunction,
      this.commsGraphqlFunction,
      this.storageOperationalFunction,
      this.financeReceiptFunction,
      this.academicsDocumentFunction,
    ];
    for (const [index, interactiveFunction] of interactiveFunctions.entries()) {
      if (props.config.environment === 'prod') {
        const resource = interactiveFunction.node.defaultChild as lambda.CfnFunction;
        resource.reservedConcurrentExecutions = props.config.interactiveReservedConcurrency;
      }
      this.addFunctionAlarms(`Interactive${index}`, interactiveFunction, props.config);
    }
    secretsmanager.Secret.fromSecretCompleteArn(this, 'MongoDbSecretReference', props.mongodbSecretArn)
      .grantRead(this.platformGraphqlFunction);
    secretsmanager.Secret.fromSecretCompleteArn(this, 'SettingsGraphqlMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.settingsGraphqlFunction);
    secretsmanager.Secret.fromSecretCompleteArn(this, 'IdentityGraphqlMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.identityGraphqlFunction);
    this.identityGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminGetUser', 'cognito-idp:AdminDisableUser', 'cognito-idp:AdminEnableUser'],
      resources: [`arn:aws:cognito-idp:${props.config.region}:${props.config.accountId}:userpool/${props.cognitoUserPoolId}`],
    }));
    secretsmanager.Secret.fromSecretCompleteArn(this, 'AcademicsGraphqlMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.academicsGraphqlFunction);
    this.academicsGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${props.config.region}:${props.config.accountId}:event-bus/${props.eventBusName}`],
    }));
    secretsmanager.Secret.fromSecretCompleteArn(this, 'AdmissionsGraphqlMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.admissionsGraphqlFunction);
    this.admissionsGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${props.config.region}:${props.config.accountId}:event-bus/${props.eventBusName}`],
    }));
    secretsmanager.Secret.fromSecretCompleteArn(this, 'FinanceGraphqlMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.financeGraphqlFunction);
    secretsmanager.Secret.fromSecretCompleteArn(this, 'FinanceReceiptMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.financeReceiptFunction);
    secretsmanager.Secret.fromSecretCompleteArn(this, 'AcademicsDocumentMongoSecretReference', props.mongodbSecretArn)
      .grantRead(this.academicsDocumentFunction);
    this.financeGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${props.documentsBucketName}/*`],
    }));
    this.financeReceiptFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${props.documentsBucketName}/*`],
    }));
    this.academicsDocumentFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`arn:aws:s3:::${props.documentsBucketName}/*`],
    }));
    this.platformGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
      resources: [`arn:aws:cognito-idp:${props.config.region}:${props.config.accountId}:userpool/${props.cognitoUserPoolId}`],
    }));
    this.platformGraphqlFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:GetAccount', 'ses:GetEmailIdentity'],
      resources: ['*'],
    }));

    const emailEventsFunction = new NodejsFunction(this, 'EmailEventsFunction', {
      functionName: `comms-email-events-${props.config.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'comms-service', 'src', 'handlers', 'ses-events.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'comms-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
      },
    });
    emailEventsFunction.addEventSource(new eventSources.SqsEventSource(props.emailEventsQueue, {
      batchSize: 10,
      reportBatchItemFailures: true,
    }));
    secretsmanager.Secret.fromSecretCompleteArn(this, 'EmailEventsMongoSecretReference', props.mongodbSecretArn).grantRead(emailEventsFunction);
    new logs.LogRetention(this, 'EmailEventsLogRetention', {
      logGroupName: `/aws/lambda/${emailEventsFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    if (props.config.environment === 'prod') {
      (emailEventsFunction.node.defaultChild as lambda.CfnFunction).reservedConcurrentExecutions =
        props.config.workerReservedConcurrency;
    }
    this.addFunctionAlarms('EmailEventsWorker', emailEventsFunction, props.config);

    new logs.LogRetention(this, 'PlatformGraphqlLogRetention', {
      logGroupName: `/aws/lambda/${this.platformGraphqlFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    new logs.LogRetention(this, 'SettingsGraphqlLogRetention', {
      logGroupName: `/aws/lambda/${this.settingsGraphqlFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    new logs.LogRetention(this, 'IdentityGraphqlLogRetention', {
      logGroupName: `/aws/lambda/${this.identityGraphqlFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    new logs.LogRetention(this, 'AcademicsGraphqlLogRetention', {
      logGroupName: `/aws/lambda/${this.academicsGraphqlFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    new logs.LogRetention(this, 'AdmissionsGraphqlLogRetention', { logGroupName: `/aws/lambda/${this.admissionsGraphqlFunction.functionName}`, retention: props.config.logRetentionDays });
    new logs.LogRetention(this, 'FinanceGraphqlLogRetention', { logGroupName: `/aws/lambda/${this.financeGraphqlFunction.functionName}`, retention: props.config.logRetentionDays });
    new logs.LogRetention(this, 'FinanceReceiptLogRetention', { logGroupName: `/aws/lambda/${this.financeReceiptFunction.functionName}`, retention: props.config.logRetentionDays });
    new logs.LogRetention(this, 'AcademicsDocumentLogRetention', { logGroupName: `/aws/lambda/${this.academicsDocumentFunction.functionName}`, retention: props.config.logRetentionDays });

    const admissionConfirmedFunction = new NodejsFunction(this, 'AdmissionConfirmedFunction', {
      functionName: `academics-admission-confirmed-${props.config.environment}`,
      description: 'Creates the authoritative student and enrollment after admission confirmation',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'academics-service', 'src', 'handlers', 'admission-confirmed.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager', '@aws-sdk/client-eventbridge'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'academics-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
        EVENT_BUS_NAME: props.eventBusName,
      },
    });
    secretsmanager.Secret.fromSecretCompleteArn(this, 'AdmissionConfirmedMongoSecretReference', props.mongodbSecretArn).grantRead(admissionConfirmedFunction);
    admissionConfirmedFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${props.config.region}:${props.config.accountId}:event-bus/${props.eventBusName}`],
    }));
    new logs.LogRetention(this, 'AdmissionConfirmedLogRetention', {
      logGroupName: `/aws/lambda/${admissionConfirmedFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    if (props.config.environment === 'prod') {
      (admissionConfirmedFunction.node.defaultChild as lambda.CfnFunction).reservedConcurrentExecutions =
        props.config.workerReservedConcurrency;
    }
    this.addFunctionAlarms('AdmissionConfirmedWorker', admissionConfirmedFunction, props.config);
    const eventBus = events.EventBus.fromEventBusName(this, 'AdmissionsEventBus', props.eventBusName);
    const admissionConfirmedDeadLetterQueue = new sqs.Queue(this, 'AdmissionConfirmedDeadLetterQueue', {
      queueName: `admission-confirmed-dlq-${props.config.environment}`,
    });
    new events.Rule(this, 'AdmissionConfirmedEventRule', {
      eventBus,
      ruleName: `admission-confirmed-events-${props.config.environment}`,
      eventPattern: {
        source: ['erp.admissions'],
        detailType: ['admissions.admission.confirmed.v1'],
      },
      targets: [new eventTargets.LambdaFunction(admissionConfirmedFunction, { retryAttempts: 2, deadLetterQueue: admissionConfirmedDeadLetterQueue })],
    });

    const studentEnrolledFunction = new NodejsFunction(this, 'StudentEnrolledFunction', {
      functionName: `finance-student-enrolled-${props.config.environment}`,
      description: 'Generates the authoritative fee order from an enrolled student and active fee mapping',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'finance-service', 'src', 'handlers', 'student-enrolled.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager'] },
      environment: {
        environment: props.config.environment,
        SERVICE_NAME: 'finance-service',
        MONGODB_SECRET_NAME: props.secretNames.mongodb,
      },
    });
    secretsmanager.Secret.fromSecretCompleteArn(this, 'StudentEnrolledMongoSecretReference', props.mongodbSecretArn).grantRead(studentEnrolledFunction);
    new logs.LogRetention(this, 'StudentEnrolledLogRetention', {
      logGroupName: `/aws/lambda/${studentEnrolledFunction.functionName}`,
      retention: props.config.logRetentionDays,
    });
    if (props.config.environment === 'prod') {
      (studentEnrolledFunction.node.defaultChild as lambda.CfnFunction).reservedConcurrentExecutions =
        props.config.workerReservedConcurrency;
    }
    this.addFunctionAlarms('StudentEnrolledWorker', studentEnrolledFunction, props.config);
    const studentEnrolledDeadLetterQueue = new sqs.Queue(this, 'StudentEnrolledDeadLetterQueue', {
      queueName: `student-enrolled-dlq-${props.config.environment}`,
    });
    new events.Rule(this, 'StudentEnrolledEventRule', {
      eventBus,
      ruleName: `student-enrolled-events-${props.config.environment}`,
      eventPattern: {
        source: ['erp.academics'],
        detailType: ['academics.student.enrolled.v1', 'academics.student.enrollment-changed.v1'],
      },
      targets: [new eventTargets.LambdaFunction(studentEnrolledFunction, { retryAttempts: 2, deadLetterQueue: studentEnrolledDeadLetterQueue })],
    });

    const academicsCampusTransferTask = new NodejsFunction(this, 'AcademicsCampusTransferTask', {
      functionName: `academics-campus-transfer-${props.config.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'academics-service', 'src', 'handlers', 'campus-transfer-task.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: props.config.lambdaMemorySize,
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager'] },
      environment: { environment: props.config.environment, SERVICE_NAME: 'academics-service', MONGODB_SECRET_NAME: props.secretNames.mongodb },
    });
    const financeCampusTransferTask = new NodejsFunction(this, 'FinanceCampusTransferTask', {
      functionName: `finance-campus-transfer-${props.config.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.resolve(process.cwd(), '..', 'apps', 'finance-service', 'src', 'handlers', 'campus-transfer-task.ts'),
      handler: 'handler',
      depsLockFilePath: path.resolve(process.cwd(), '..', '..', 'pnpm-lock.yaml'),
      memorySize: Math.max(props.config.lambdaMemorySize, 512),
      timeout: props.config.lambdaTimeout,
      bundling: { externalModules: ['@aws-sdk/client-secrets-manager'] },
      environment: { environment: props.config.environment, SERVICE_NAME: 'finance-service', MONGODB_SECRET_NAME: props.secretNames.mongodb },
    });
    const mongoReference = secretsmanager.Secret.fromSecretCompleteArn(this, 'CampusTransferMongoSecretReference', props.mongodbSecretArn);
    mongoReference.grantRead(academicsCampusTransferTask);
    mongoReference.grantRead(financeCampusTransferTask);
    for (const [id, fn] of [['AcademicsCampusTransfer', academicsCampusTransferTask], ['FinanceCampusTransfer', financeCampusTransferTask]] as const) {
      new logs.LogRetention(this, `${id}LogRetention`, { logGroupName: `/aws/lambda/${fn.functionName}`, retention: props.config.logRetentionDays });
      this.addFunctionAlarms(id, fn, props.config);
    }

    const getTransferContext = new tasks.LambdaInvoke(this, 'GetCampusTransferContext', {
      lambdaFunction: academicsCampusTransferTask,
      payloadResponseOnly: true,
      resultPath: '$.transfer',
      payload: sfn.TaskInput.fromObject({ operation: 'GET_CONTEXT', 'tenantId.$': '$.tenantId', 'transferId.$': '$.transferId', 'financeApproved.$': '$.financeApproved' }),
    });
    const assessAndApplyFinance = new tasks.LambdaInvoke(this, 'AssessAndApplyCampusTransferFinance', {
      lambdaFunction: financeCampusTransferTask,
      payloadResponseOnly: true,
      resultPath: '$.finance',
      payload: sfn.TaskInput.fromObject({ operation: 'ASSESS_AND_APPLY', 'id.$': '$.transfer.id', 'tenantId.$': '$.transfer.tenantId', 'studentId.$': '$.transfer.studentId', 'studentName.$': '$.transfer.studentName', 'admissionApplicationId.$': '$.transfer.admissionApplicationId', 'registrationNumber.$': '$.transfer.targetRegistrationNumber', 'source.$': '$.transfer.source', 'target.$': '$.transfer.target', 'requestedBy.$': '$.transfer.requestedBy', 'financeApproved.$': '$.transfer.financeApproved' }),
    });
    const commitAcademicTransfer = new tasks.LambdaInvoke(this, 'CommitCampusTransferEnrollment', {
      lambdaFunction: academicsCampusTransferTask,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({ operation: 'COMMIT', 'tenantId.$': '$.transfer.tenantId', 'transferId.$': '$.transfer.id', 'financeAssessment.$': '$.finance.assessment' }),
    });
    const markFinanceReview = new tasks.LambdaInvoke(this, 'MarkCampusTransferUnderReview', {
      lambdaFunction: academicsCampusTransferTask,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({ operation: 'UNDER_REVIEW', 'tenantId.$': '$.transfer.tenantId', 'transferId.$': '$.transfer.id', 'financeAssessment.$': '$.finance.assessment', 'warning.$': '$.finance.warning' }),
    });
    const compensateFinance = new tasks.LambdaInvoke(this, 'CompensateCampusTransferFinance', {
      lambdaFunction: financeCampusTransferTask,
      payloadResponseOnly: true,
      resultPath: '$.compensation',
      payload: sfn.TaskInput.fromObject({ operation: 'COMPENSATE', 'id.$': '$.transfer.id', 'tenantId.$': '$.transfer.tenantId', 'studentId.$': '$.transfer.studentId', 'studentName.$': '$.transfer.studentName', 'admissionApplicationId.$': '$.transfer.admissionApplicationId', 'registrationNumber.$': '$.transfer.registrationNumber', 'source.$': '$.transfer.source', 'target.$': '$.transfer.target', 'requestedBy.$': '$.transfer.requestedBy' }),
    });
    const markTransferFailed = new tasks.LambdaInvoke(this, 'MarkCampusTransferFailed', {
      lambdaFunction: academicsCampusTransferTask,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({ operation: 'FAILED', 'tenantId.$': '$.transfer.tenantId', 'transferId.$': '$.transfer.id', failureReason: 'Campus transfer failed after finance processing; compensation was applied.' }),
    });
    const markTransferContextFailed = new tasks.LambdaInvoke(this, 'MarkCampusTransferContextFailed', {
      lambdaFunction: academicsCampusTransferTask,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({ operation: 'FAILED', 'tenantId.$': '$.tenantId', 'transferId.$': '$.transferId', failureReason: 'Campus transfer context could not be loaded.' }),
    });
    const failureChain = compensateFinance.next(markTransferFailed);
    getTransferContext.addCatch(markTransferContextFailed, { resultPath: '$.error' });
    assessAndApplyFinance.addCatch(markTransferFailed, { resultPath: '$.error' });
    compensateFinance.addCatch(markTransferFailed, { resultPath: '$.compensationError' });
    commitAcademicTransfer.addCatch(failureChain, { resultPath: '$.error' });
    const transferDefinition = getTransferContext.next(assessAndApplyFinance).next(new sfn.Choice(this, 'CampusTransferNeedsFinanceReview')
      .when(sfn.Condition.booleanEquals('$.finance.requiresReview', true), markFinanceReview)
      .otherwise(commitAcademicTransfer));
    const campusTransferStateMachine = new sfn.StateMachine(this, 'CampusTransferStateMachine', {
      stateMachineName: `campus-transfer-${props.config.environment}`,
      definitionBody: sfn.DefinitionBody.fromChainable(transferDefinition),
      timeout: Duration.minutes(10),
      logs: { destination: new logs.LogGroup(this, 'CampusTransferWorkflowLogs', { logGroupName: `/aws/vendedlogs/states/campus-transfer-${props.config.environment}`, retention: props.config.logRetentionDays }), level: sfn.LogLevel.ALL, includeExecutionData: true },
      tracingEnabled: true,
    });
    this.academicsGraphqlFunction.addEnvironment('CAMPUS_TRANSFER_STATE_MACHINE_ARN', campusTransferStateMachine.stateMachineArn);
    campusTransferStateMachine.grantStartExecution(this.academicsGraphqlFunction);
    new CfnOutput(this, 'CampusTransferStateMachineArn', { value: campusTransferStateMachine.stateMachineArn });

    new cloudwatch.Alarm(this, 'AccountConcurrencyAlarm', {
      alarmName: `lambda-account-concurrency-${props.config.environment}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        statistic: 'Maximum',
        period: Duration.minutes(1),
      }),
      threshold: props.config.environment === 'prod' ? 800 : 150,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }

  private addFunctionAlarms(
    id: string,
    target: lambda.Function,
    config: EnvironmentConfig,
  ): void {
    new cloudwatch.Alarm(this, `${id}ThrottleAlarm`, {
      alarmName: `${target.functionName}-throttles`,
      metric: target.metricThrottles({ period: Duration.minutes(1), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, `${id}ErrorAlarm`, {
      alarmName: `${target.functionName}-errors`,
      metric: target.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: config.environment === 'prod' ? 5 : 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, `${id}DurationAlarm`, {
      alarmName: `${target.functionName}-p95-duration`,
      metric: target.metricDuration({ period: Duration.minutes(5), statistic: 'p95' }),
      threshold: config.lambdaTimeout.toMilliseconds() * 0.8,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }

  public getFunction(serviceName: ServiceName): lambda.Function {
    return this.services[serviceName];
  }
}
