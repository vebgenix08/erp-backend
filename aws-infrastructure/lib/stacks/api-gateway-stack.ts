import { CfnOutput, Stack, StackProps, aws_apigateway as apigateway, aws_lambda as lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import type { ServiceName } from './lambda-services-stack';

export interface ApiGatewayStackProps extends StackProps {
  config: EnvironmentConfig;
  healthFunctions: Record<ServiceName, lambda.IFunction>;
}

export class ApiGatewayStack extends Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: props.config.apiName,
      description: `ERP API for ${props.config.environment}`,
      deployOptions: {
        stageName: props.config.apiStageName,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const health = this.api.root.addResource('health');
    health.addMethod(
      'GET',
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': JSON.stringify({
                ok: true,
                service: 'api',
                environment: props.config.environment,
              }),
            },
          },
        ],
        requestTemplates: {
          'application/json': '{"statusCode": 200}',
        },
      }),
      {
        methodResponses: [{ statusCode: '200' }],
      },
    );

    for (const [serviceName, serviceFunction] of Object.entries(props.healthFunctions) as Array<[ServiceName, lambda.IFunction]>) {
      const route = health.addResource(serviceName);
      route.addMethod('GET', new apigateway.LambdaIntegration(serviceFunction), {
        methodResponses: [{ statusCode: '200' }],
      });
    }

    new CfnOutput(this, 'ApiUrl', {
      value: this.api.url ?? 'pending',
    });
  }
}
