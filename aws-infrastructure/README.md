# AWS Infrastructure

This package contains the CDK scaffold for the ERP deployment target.

## Requirements

- CDK context `--context environment=dev|prod` (preferred), or process environment variable `environment`
- `AWS_ACCOUNT_ID`
- `AWS_REGION`

Optional:

- `S3_BUCKET_PREFIX` for globally unique document bucket names
- `GITHUB_REPOSITORY`
- `GITHUB_BRANCH`
- `COGNITO_DOMAIN_PREFIX`

## Install

```powershell
cd E:\Application\school-erp\backend\aws-infrastructure
pnpm install
```

## Synthesize

```powershell
$env:AWS_ACCOUNT_ID = '<your-account-id>'
$env:AWS_REGION = 'ap-south-1'
pnpm cdk synth --context environment=dev
```

## Deploy

```powershell
pnpm cdk deploy github-oidc-role-dev
pnpm cdk deploy cognito-dev
pnpm cdk deploy storage-dev
pnpm cdk deploy events-dev
pnpm cdk deploy secrets-dev
pnpm cdk deploy lambda-services-dev
pnpm cdk deploy api-dev
```

For production, switch `environment=prod` and deploy the corresponding `*-prod` stacks.

Invite email delivery belongs to `comms-service`, not Lambda handlers.
Use Step Functions only for real multi-step orchestration.
