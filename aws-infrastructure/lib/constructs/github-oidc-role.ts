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
    const subjects = props.config.githubRepositories.flatMap((repository) =>
      props.config.githubEnvironments.map((environment) => `repo:${repository}:environment:${environment}`),
    );

    this.role = new iam.Role(this, 'Role', {
      roleName: `github-oidc-role-${props.config.environment}`,
      description: 'GitHub Actions deployment role restricted to approved ERP repositories and environments',
      assumedBy: new iam.FederatedPrincipal(
        providerArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': subjects,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });
  }
}
