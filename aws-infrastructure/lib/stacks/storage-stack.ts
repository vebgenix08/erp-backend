import { CfnOutput, RemovalPolicy, Stack, StackProps, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import { DocumentBucket } from '../constructs/document-bucket';

export interface StorageStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class StorageStack extends Stack {
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const bucket = new DocumentBucket(this, 'DocumentsBucket', { config: props.config });
    this.documentsBucket = bucket.bucket;

    new CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
    });

    if (props.config.removalPolicy === RemovalPolicy.DESTROY) {
      new CfnOutput(this, 'DocumentsBucketRemovalPolicy', {
        value: 'DESTROY',
      });
    }
  }
}
