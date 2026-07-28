import { CfnOutput, Stack, type StackProps, aws_apigateway as apigateway } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';

export interface ApiGatewayRestStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class ApiGatewayRestStack extends Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayRestStackProps) {
    super(scope, id, props);
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: props.config.restApiName,
      description: `Public and external ERP integration API for ${props.config.environment}`,
      deployOptions: {
        stageName: props.config.apiStageName,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
    });

    const health = this.api.root.addResource('health');
    health.addMethod('GET', new apigateway.MockIntegration({
      requestTemplates: { 'application/json': '{"statusCode": 200}' },
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: { 'application/json': JSON.stringify({ ok: true, api: 'external', environment: props.config.environment }) },
      }],
    }), { methodResponses: [{ statusCode: '200' }] });

    new CfnOutput(this, 'RestApiUrl', { value: this.api.url });
  }
}
