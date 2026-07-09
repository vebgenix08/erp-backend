import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config';

export interface GithubOidcRoleProps {
  config: EnvironmentConfig;
}

export class GithubOidcRole extends Construct {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: GithubOidcRoleProps) {
    super(scope, id);

    const providerArn = `arn:aws:iam::${props.config.accountId}:oidc-provider/token.actions.githubusercontent.com`;
    const subject = props.config.githubRepository === '*/*'
      ? 'repo:*/*:ref:refs/heads/*'
      : `repo:${props.config.githubRepository}:ref:refs/heads/${props.config.githubBranch}`;

    this.role = new iam.Role(this, 'Role', {
      roleName: `github-oidc-role-${props.config.environment}`,
      description: 'Placeholder GitHub Actions role for ERP deployment',
      assumedBy: new iam.FederatedPrincipal(
        providerArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': subject,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });
  }
}
