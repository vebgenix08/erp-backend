import {
  CfnOutput,
  Duration,
  Stack,
  type StackProps,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "../config";

export interface FrontendHostingStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class FrontendHostingStack extends Stack {
  public readonly distribution: cloudfront.Distribution;
  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: props.config.frontendBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.config.removalPolicy,
      autoDeleteObjects: props.config.environment === "dev",
    });

    const distribution = new cloudfront.Distribution(this, "FrontendDistribution", {
      comment: `frontend-${props.config.environment}`,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket as unknown as s3.IBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: "/index.html",
        ttl: Duration.seconds(0),
      })),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });
    this.distribution = distribution;

    new CfnOutput(this, "FrontendBucketName", { value: bucket.bucketName });
    new CfnOutput(this, "CloudFrontDistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "FrontendUrl", { value: `https://${distribution.distributionDomainName}` });
  }
}
