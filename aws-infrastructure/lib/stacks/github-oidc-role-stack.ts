import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';
import { GithubOidcRole } from '../constructs/github-oidc-role';

export interface GithubOidcRoleStackProps extends StackProps {
  config: EnvironmentConfig;
}

export class GithubOidcRoleStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubOidcRoleStackProps) {
    super(scope, id, props);

    const role = new GithubOidcRole(this, 'GithubOidcRole', { config: props.config });

    new CfnOutput(this, 'GithubOidcRoleArn', {
      value: role.role.roleArn,
    });
  }
}
