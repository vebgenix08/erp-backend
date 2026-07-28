import * as path from "path";
import {
  CfnOutput,
  Stack,
  type StackProps,
  aws_appsync as appsync,
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import type { EnvironmentConfig } from "../config";

export interface AppSyncStackProps extends StackProps {
  config: EnvironmentConfig;
  userPoolId: string;
  platformGraphqlFunction: lambda.IFunction;
  identityGraphqlFunction: lambda.IFunction;
  settingsGraphqlFunction: lambda.IFunction;
  academicsGraphqlFunction: lambda.IFunction;
  admissionsGraphqlFunction: lambda.IFunction;
  financeGraphqlFunction: lambda.IFunction;
  commsGraphqlFunction: lambda.IFunction;
}

export class AppSyncStack extends Stack {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: AppSyncStackProps) {
    super(scope, id, props);

    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      "UserPool",
      props.userPoolId,
    );
    this.api = new appsync.GraphqlApi(this, "GraphqlApi", {
      name: props.config.graphqlApiName,
      definition: appsync.Definition.fromFile(
        path.resolve(
          process.cwd(),
          "..",
          "graphql-api",
          "generated",
          "schema.graphql",
        ),
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
        additionalAuthorizationModes: [
          { authorizationType: appsync.AuthorizationType.IAM },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ERROR,
        retention: props.config.logRetentionDays,
        excludeVerboseContent: true,
      },
      xrayEnabled: true,
    });

    const webAcl = new wafv2.CfnWebACL(this, "GraphqlWebAcl", {
      name: `appsync-waf-${props.config.environment}`,
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `appsync-waf-${props.config.environment}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedCommonRules",
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              name: "AWSManagedRulesCommonRuleSet",
              vendorName: "AWS",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "common-rules",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "IpRateLimit",
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: { aggregateKeyType: "IP", limit: 2000 },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "ip-rate-limit",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
    new wafv2.CfnWebACLAssociation(this, "GraphqlWebAclAssociation", {
      resourceArn: `arn:aws:appsync:${props.config.region}:${props.config.accountId}:apis/${this.api.apiId}`,
      webAclArn: webAcl.attrArn,
    });

    const systemDataSource = this.api.addNoneDataSource("SystemDataSource");
    systemDataSource.createResolver("ApiHealthResolver", {
      typeName: "Query",
      fieldName: "apiHealth",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
        "version": "2018-05-29",
        "payload": {"ok": true, "environment": "${props.config.environment}"}
      }`),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        "$util.toJson($ctx.result)",
      ),
    });
    const platformDataSource = this.api.addLambdaDataSource(
      "PlatformDataSource",
      props.platformGraphqlFunction,
    );
    const identityDataSource = this.api.addLambdaDataSource(
      "IdentityDataSource",
      props.identityGraphqlFunction,
    );
    const settingsDataSource = this.api.addLambdaDataSource(
      "SettingsDataSource",
      props.settingsGraphqlFunction,
    );
    const academicsDataSource = this.api.addLambdaDataSource(
      "AcademicsDataSource",
      props.academicsGraphqlFunction,
    );
    const admissionsDataSource = this.api.addLambdaDataSource(
      "AdmissionsDataSource",
      props.admissionsGraphqlFunction,
    );
    const financeDataSource = this.api.addLambdaDataSource(
      "FinanceDataSource",
      props.financeGraphqlFunction,
    );
    const commsDataSource = this.api.addLambdaDataSource(
      "CommsDataSource",
      props.commsGraphqlFunction,
    );
    commsDataSource.createResolver("CommsQueryInviteDeliveryEvents", {
      typeName: "Query",
      fieldName: "inviteDeliveryEvents",
    });
    for (const fieldName of [
      "currentTenantSummary",
      "tenants",
      "tenant",
      "platformDashboardSummary",
      "platformFeatureFlags",
      "platformAuditLogs",
      "firstAdminBootstrap",
      "tenantCapabilityCatalog",
      "tenantEntitlements",
      "platformIntegrations",
    ]) {
      platformDataSource.createResolver(`PlatformQuery${fieldName}`, {
        typeName: "Query",
        fieldName,
      });
    }
    for (const fieldName of [
      "provisionTenant",
      "updateTenant",
      "deactivateTenant",
      "activateTenant",
      "suspendTenant",
      "requestTenantDeletion",
      "confirmTenantDeletion",
      "createPlatformFeatureFlag",
      "updatePlatformFeatureFlag",
      "createFirstAdminBootstrap",
      "resendFirstAdminBootstrapInvite",
      "completeFirstAdminBootstrap",
      "setTenantEntitlement",
      "setPlatformIntegration",
    ]) {
      platformDataSource.createResolver(`PlatformMutation${fieldName}`, {
        typeName: "Mutation",
        fieldName,
      });
    }
    for (const fieldName of [
      "identityUsers",
      "identityRoles",
      "identityAccess",
      "employees",
      "employee",
      "employeeInviteAttempts",
    ]) {
      identityDataSource.createResolver(`IdentityQuery${fieldName}`, {
        typeName: "Query",
        fieldName,
      });
    }
    for (const fieldName of [
      "createIdentityRole",
      "updateIdentityRole",
      "deactivateIdentityRole",
      "assignIdentityUserRole",
      "revokeIdentityUserRole",
      "saveIdentityRolePermissions",
      "createEmployee",
      "updateEmployee",
      "resendEmployeeInvite",
      "endEmployment",
    ]) {
      identityDataSource.createResolver(`IdentityMutation${fieldName}`, {
        typeName: "Mutation",
        fieldName,
      });
    }
    for (const fieldName of [
      "institutionProfile",
      "campuses",
      "academicYears",
      "tenantReadiness",
      "tenantAdminDashboard",
      "tenantTemplates",
      "numberingPolicies",
      "notificationPolicy",
    ]) {
      settingsDataSource.createResolver(`SettingsQuery${fieldName}`, {
        typeName: "Query",
        fieldName,
      });
    }
    for (const fieldName of [
      "updateInstitutionProfile",
      "createCampus",
      "updateCampus",
      "deactivateCampus",
      "reactivateCampus",
      "createAcademicYear",
      "updateAcademicYear",
      "activateAcademicYear",
      "closeAcademicYear",
      "reopenAcademicYear",
      "createTenantTemplate",
      "updateTenantTemplate",
      "publishTenantTemplate",
      "archiveTenantTemplate",
      "saveNumberingPolicy",
      "updateNotificationPolicy",
    ]) {
      settingsDataSource.createResolver(`SettingsMutation${fieldName}`, {
        typeName: "Mutation",
        fieldName,
      });
    }
    for (const fieldName of [
      "academicPrograms",
      "academicClasses",
      "academicSections",
      "academicSubjects",
      "teachingAssignments",
      "studentDocuments",
      "studentDocument",
      "students",
      "studentPage",
      "student",
      "studentByAdmissionApplicationId",
      "studentNotes",
    ]) {
      academicsDataSource.createResolver(`AcademicsQuery${fieldName}`, {
        typeName: "Query",
        fieldName,
      });
    }
    for (const fieldName of [
      "enquiries",
      "enquiryPage",
      "enquiry",
      "applications",
      "applicationPage",
      "application",
      "applicationDuplicateCheck",
    ])
      admissionsDataSource.createResolver(`AdmissionsQuery${fieldName}`, {
        typeName: "Query",
        fieldName,
      });
    for (const fieldName of [
      "createEnquiry",
      "updateEnquiry",
      "closeEnquiry",
      "createApplication",
      "updateApplication",
      "submitApplication",
      "approveApplication",
      "rejectApplication",
      "cancelApplication",
      "confirmApplication",
    ])
      admissionsDataSource.createResolver(`AdmissionsMutation${fieldName}`, {
        typeName: "Mutation",
        fieldName,
      });
    for (const fieldName of [
      "createAcademicProgram",
      "updateAcademicProgram",
      "deactivateAcademicProgram",
      "createAcademicClass",
      "updateAcademicClass",
      "deactivateAcademicClass",
      "createAcademicSection",
      "updateAcademicSection",
      "deactivateAcademicSection",
      "createAcademicSubject",
      "updateAcademicSubject",
      "deactivateAcademicSubject",
      "createTeachingAssignment",
      "deactivateTeachingAssignment",
      "issueStudentDocument",
      "revokeStudentDocument",
      "changeStudentEnrollment",
      "createStudentNote",
      "updateStudentNote",
    ]) {
      academicsDataSource.createResolver(`AcademicsMutation${fieldName}`, {
        typeName: "Mutation",
        fieldName,
      });
    }
    financeDataSource.createResolver("FinanceQueryFeeConfiguration", {
      typeName: "Query",
      fieldName: "feeConfiguration",
    });
    financeDataSource.createResolver("FinanceQueryDashboard", {
      typeName: "Query",
      fieldName: "financeDashboard",
    });
    financeDataSource.createResolver("FinanceQueryReceipt", {
      typeName: "Query",
      fieldName: "financeReceipt",
    });
    financeDataSource.createResolver("FinanceQueryReceiptTemplate", {
      typeName: "Query",
      fieldName: "financeReceiptTemplate",
    });
    financeDataSource.createResolver("FinanceQueryPayments", {
      typeName: "Query",
      fieldName: "financePayments",
    });
    financeDataSource.createResolver("FinanceQueryPaymentPage", {
      typeName: "Query",
      fieldName: "financePaymentPage",
    });
    financeDataSource.createResolver("FinanceQueryPaymentAdjustments", {
      typeName: "Query",
      fieldName: "financePaymentAdjustments",
    });
    financeDataSource.createResolver("FinanceQueryFeeOrderRecoveries", {
      typeName: "Query",
      fieldName: "feeOrderRecoveries",
    });
    financeDataSource.createResolver("FinanceQueryFeeOrders", {
      typeName: "Query",
      fieldName: "feeOrders",
    });
    financeDataSource.createResolver("FinanceQueryFeeOrderPage", {
      typeName: "Query",
      fieldName: "feeOrderPage",
    });
    financeDataSource.createResolver("FinanceQueryGeneralCharges", {
      typeName: "Query",
      fieldName: "generalCharges",
    });
    financeDataSource.createResolver("FinanceQueryFeeOrder", {
      typeName: "Query",
      fieldName: "feeOrder",
    });
    for (const fieldName of [
      "createFeeHead",
      "updateFeeHead",
      "createFeeSchedule",
      "createFeeStructure",
      "createFeeMapping",
      "setFeeConfigurationStatus",
    ]) {
      financeDataSource.createResolver(`FinanceMutation${fieldName}`, {
        typeName: "Mutation",
        fieldName,
      });
    }
    financeDataSource.createResolver("FinanceMutationCollectPayment", {
      typeName: "Mutation",
      fieldName: "collectFinancePayment",
    });
    financeDataSource.createResolver("FinanceMutationCreateGeneralCharge", {
      typeName: "Mutation",
      fieldName: "createGeneralCharge",
    });
    financeDataSource.createResolver("FinanceMutationSaveReceiptTemplate", {
      typeName: "Mutation",
      fieldName: "saveFinanceReceiptTemplate",
    });
    financeDataSource.createResolver("FinanceMutationCreatePaymentAdjustment", {
      typeName: "Mutation",
      fieldName: "createFinancePaymentAdjustment",
    });
    financeDataSource.createResolver("FinanceMutationRetryFeeOrderRecovery", {
      typeName: "Mutation",
      fieldName: "retryFeeOrderRecovery",
    });

    new CfnOutput(this, "GraphqlUrl", { value: this.api.graphqlUrl });
    new CfnOutput(this, "GraphqlApiId", { value: this.api.apiId });
  }
}
