import { CfnOutput, Stack, type StackProps, aws_apigatewayv2 as apigatewayv2, aws_lambda as lambda } from 'aws-cdk-lib';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import type { ServiceName } from './lambda-services-stack';

export interface ApiGatewayHttpStackProps extends StackProps {
  config: EnvironmentConfig;
  healthFunctions: Record<ServiceName, lambda.IFunction>;
  storageFunction: lambda.IFunction;
  financeReceiptFunction: lambda.IFunction;
  academicsDocumentFunction: lambda.IFunction;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
}

export class ApiGatewayHttpStack extends Stack {
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiGatewayHttpStackProps) {
    super(scope, id, props);
    this.api = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: props.config.httpApiName,
      description: `Authenticated ERP operational API for ${props.config.environment}`,
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type', 'x-request-id'],
        exposeHeaders: ['content-disposition', 'content-type'],
        allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.POST, apigatewayv2.CorsHttpMethod.DELETE, apigatewayv2.CorsHttpMethod.OPTIONS],
        allowOrigins: props.config.allowedOrigins,
      },
    });
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage | undefined;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
        detailedMetricsEnabled: true,
      };
    }

    for (const [serviceName, serviceFunction] of Object.entries(props.healthFunctions) as Array<[ServiceName, lambda.IFunction]>) {
      this.api.addRoutes({
        path: `/health/${serviceName}`,
        methods: [apigatewayv2.HttpMethod.GET],
        integration: new HttpLambdaIntegration(`${serviceName}Health`, serviceFunction),
      });
    }
    const storageIntegration = new HttpLambdaIntegration('StorageFilesIntegration', props.storageFunction);
    const authorizer = new HttpJwtAuthorizer(
      'CognitoJwtAuthorizer',
      `https://cognito-idp.${props.config.region}.amazonaws.com/${props.cognitoUserPoolId}`,
      { jwtAudience: [props.cognitoUserPoolClientId] },
    );
    for (const path of ['/files', '/files/{proxy+}']) {
      this.api.addRoutes({
        path,
        methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.DELETE],
        integration: storageIntegration,
        authorizer,
      });
    }
    this.api.addRoutes({
      path: '/v1/payments/{paymentId}/receipt.pdf',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('FinanceReceiptPdfIntegration', props.financeReceiptFunction),
      authorizer,
    });
    this.api.addRoutes({
      path: '/v1/student-documents/{documentId}/pdf',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('AcademicsStudentDocumentPdfIntegration', props.academicsDocumentFunction),
      authorizer,
    });
    new CfnOutput(this, 'HttpApiUrl', { value: this.api.apiEndpoint });
  }
}
