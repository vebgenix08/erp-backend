import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import {
  createTenantUseCase,
  deactivateTenantUseCase,
  getTenantUseCase,
  listTenantsUseCase,
  updateTenantUseCase,
  activateTenantUseCase,
  suspendTenantUseCase,
  requestTenantDeletionUseCase,
  confirmTenantDeletionUseCase,
} from "../modules/tenants/use-cases";
import type { TenantServiceDeps } from "../modules/tenants/tenants.service";
import { hydratePlatformRuntimeConfig } from "./runtime-config";
import { platformPermissions } from "../permissions";
import { requirePlatformPermission } from "../middleware";
import { getPlatformDashboardSummary } from "../modules/dashboard/dashboard.service";
import type { DashboardRepositoryDeps } from "../modules/dashboard/dashboard.repository";
import { createFeatureFlag, listFeatureFlags, updateFeatureFlag, type FeatureFlagServiceDeps } from "../modules/feature-flags/feature-flags.service";
import { appendAuditLog, listAuditLogs, type AuditLogServiceDeps } from "../modules/audit-logs/audit-logs.service";
import { completeFirstAdminBootstrap, createFirstAdminBootstrap, getFirstAdminBootstrap, resendFirstAdminBootstrapInvite, type FirstAdminBootstrapServiceDeps } from "../modules/bootstrap/bootstrap.service";
import { createCognitoFirstAdminInvitePort } from "./cognito-first-admin-invite";
import { provisionTenant, type ProvisioningServiceDeps } from "../modules/provisioning/provisioning.service";
import { listTenantEntitlements, setTenantEntitlement, type EntitlementDeps } from "../modules/entitlements/entitlements.service";
import { listPlatformIntegrations, setPlatformIntegration, type IntegrationDeps } from "../modules/integrations/integrations.service";
import { listTenantCapabilities } from "../modules/capability-catalog/capability-catalog.service";

interface AppSyncIdentity {
  sub?: string;
  claims?: Record<string, unknown>;
}

export interface PlatformGraphqlEvent {
  info: { fieldName: string };
  arguments?: Record<string, unknown>;
  identity?: AppSyncIdentity | null;
  request?: { headers?: Record<string, string> };
  stash?: Record<string, unknown>;
}

function stringClaim(claims: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = claims[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function createPlatformGraphqlContext(event: PlatformGraphqlEvent): RequestContext {
  const claims = event.identity?.claims ?? {};
  const groups = claims["cognito:groups"];
  const groupList = Array.isArray(groups) ? groups : typeof groups === "string" ? groups.split(",") : [];
  const role = stringClaim(claims, "custom:role", "role") ?? (groupList.includes("SUPER_ADMIN") ? "SUPER_ADMIN" : undefined);
  const systemPermissions = role === "SUPER_ADMIN"
    ? Object.values(platformPermissions).flatMap((resource) => Object.values(resource))
    : [];
  const userId = event.identity?.sub ?? stringClaim(claims, "sub");
  const tenantId = stringClaim(claims, "custom:tenantId", "tenantId");
  if (!userId) throw new ForbiddenError("authenticated AppSync identity is required");

  return {
    requestId: event.request?.headers?.["x-amzn-trace-id"] ?? `gql_${crypto.randomUUID()}`,
    path: `graphql:${event.info.fieldName}`,
    method: "POST",
    headers: event.request?.headers ?? {},
    query: {},
    body: event.arguments ?? {},
    params: {},
    ...(tenantId ? { tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() } } : {}),
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      user: {
        id: userId,
        email: stringClaim(claims, "email"),
        role,
        permissions: normalizePermissions([
          ...systemPermissions,
          ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions),
        ]),
        source: "jwt-claims",
      },
    },
  };
}

function input(args: Record<string, unknown>): Record<string, unknown> {
  const value = args.input;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  }
  return value as Record<string, unknown>;
}

function requiredString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError([{ field: name, message: `${name} is required` }]);
  }
  return value.trim();
}

export interface PlatformGraphqlDeps extends TenantServiceDeps {
  dashboard?: DashboardRepositoryDeps;
  featureFlags?: FeatureFlagServiceDeps;
  auditLogs?: AuditLogServiceDeps;
  bootstrap?: FirstAdminBootstrapServiceDeps;
  provisioning?: ProvisioningServiceDeps;
  entitlements?: EntitlementDeps;
  integrations?: IntegrationDeps;
}

export function firstAdminInviteAuditAction(status: string): string {
  return status === "FAILED" ? "TENANT_ADMIN_INVITE_FAILED" : "TENANT_ADMIN_INVITE_RESENT";
}

async function executePlatformGraphql(event: PlatformGraphqlEvent, deps: PlatformGraphqlDeps = {}): Promise<unknown> {
  const context = createPlatformGraphqlContext(event);
  const args = event.arguments ?? {};

  switch (event.info.fieldName) {
    case "currentTenantSummary": {
      const tenantId = context.tenantContext?.tenantId;
      if (!tenantId) throw new ForbiddenError("authenticated tenant identity is required");
      const repository = await (deps.repository ?? (await import("../modules/tenants/tenants.repository")).createTenantRepository());
      const tenant = await repository.getById(tenantId);
      if (!tenant || tenant.deletedAt) throw new NotFoundError("tenant not found");
      return { name: tenant.name, code: tenant.code, slug: tenant.slug, status: tenant.status };
    }
    case "tenants": {
      requirePlatformPermission(context, platformPermissions.tenants.read);
      const first = typeof args.first === "number" ? Math.min(Math.max(Math.trunc(args.first), 1), 100) : 25;
      const parsedCursor = typeof args.after === "string" && args.after.startsWith("cursor:")
        ? Number.parseInt(args.after.slice("cursor:".length), 10)
        : -1;
      const offset = Number.isFinite(parsedCursor) ? parsedCursor + 1 : 0;
      const repository = await (deps.repository ?? (await import("../modules/tenants/tenants.repository")).createTenantRepository());
      const result = await repository.listPage({
        limit: first,
        offset,
        ...(typeof args.status === "string" ? { status: args.status as never } : {}),
        ...(typeof args.search === "string" ? { search: args.search } : {}),
      });
      const page = result.items.map((tenant) => ({ ...tenant, organizationName: tenant.name, createdAt: tenant.createdAt.toISOString(), updatedAt: tenant.updatedAt.toISOString(), deactivatedAt: tenant.deactivatedAt?.toISOString(), deletionRequestedAt: tenant.deletionRequestedAt?.toISOString(), deletedAt: tenant.deletedAt?.toISOString() }));
      return {
        edges: page.map((node, index) => ({ node, cursor: `cursor:${offset + index}` })),
        pageInfo: {
          endCursor: page.length ? `cursor:${offset + page.length - 1}` : null,
          hasNextPage: result.hasNextPage,
        },
      };
    }
    case "tenant":
      return getTenantUseCase(requiredString(args, "tenantId"), context, deps);
    case "platformDashboardSummary":
      return getPlatformDashboardSummary(context, {
        ...(deps.repository ? { tenants: deps.repository } : {}),
        ...deps.dashboard,
      });
    case "platformFeatureFlags":
      return listFeatureFlags(context, deps.featureFlags);
    case "platformAuditLogs":
      return listAuditLogs(context, {
        ...deps.auditLogs,
        ...(deps.repository ? { tenants: deps.repository } : {}),
      }, {
        ...(typeof args.tenantId === "string" ? { tenantId: args.tenantId } : {}),
        ...(typeof args.entityType === "string" ? { entityType: args.entityType } : {}),
        ...(typeof args.action === "string" ? { action: args.action } : {}),
        limit: typeof args.first === "number" ? Math.min(Math.max(Math.trunc(args.first), 1), 100) : 50,
        offset: typeof args.after === "string" && args.after.startsWith("cursor:") ? Math.max(0, Number.parseInt(args.after.slice(7), 10) + 1) : 0,
      });
    case "firstAdminBootstrap":
      return getFirstAdminBootstrap(requiredString(args, "tenantId"), context, deps.bootstrap);
    case "tenantCapabilityCatalog":
      return listTenantCapabilities(context);
    case "tenantEntitlements":
      return listTenantEntitlements(typeof args.tenantId === "string" ? args.tenantId : undefined, context, deps.entitlements);
    case "platformIntegrations":
      return listPlatformIntegrations(context, deps.integrations);
    case "createTenant": {
      const payload = input(args);
      return createTenantUseCase(payload, context, deps);
    }
    case "provisionTenant":
      return provisionTenant(input(args), context, {
        ...((deps.provisioning?.tenants ?? deps.repository) ? { tenants: deps.provisioning?.tenants ?? deps.repository } : {}),
        bootstrap: {
          ...deps.provisioning?.bootstrap,
          invitePort: deps.provisioning?.bootstrap?.invitePort ?? createCognitoFirstAdminInvitePort(),
        },
        ...((deps.provisioning?.auditLogs ?? deps.auditLogs) ? { auditLogs: deps.provisioning?.auditLogs ?? deps.auditLogs } : {}),
      });
    case "updateTenant": {
      const payload = input(args);
      const tenantId = requiredString(payload, "tenantId");
      const { clientRequestId: _clientRequestId, tenantId: _tenantId, ...update } = payload;
      const result = await updateTenantUseCase(tenantId, update, context, deps);
      if (!result) throw new NotFoundError("tenant not found");
      return result;
    }
    case "deactivateTenant": {
      const result = await deactivateTenantUseCase(requiredString(args, "tenantId"), context, deps);
      if (!result) throw new NotFoundError("tenant not found");
      return result;
    }
    case "activateTenant": {
      const result = await activateTenantUseCase(requiredString(args, "tenantId"), context, deps);
      if (!result) throw new NotFoundError("tenant not found");
      return result;
    }
    case "suspendTenant": {
      const result = await suspendTenantUseCase(requiredString(args, "tenantId"), context, deps);
      if (!result) throw new NotFoundError("tenant not found");
      return result;
    }
    case "requestTenantDeletion": {
      const result = await requestTenantDeletionUseCase(requiredString(args, "tenantId"), requiredString(args, "reason"), context, deps);
      if (!result) throw new NotFoundError("tenant not found");
      return result;
    }
    case "confirmTenantDeletion": {
      const result = await confirmTenantDeletionUseCase(requiredString(args, "tenantId"), context, deps);
      if (!result) throw new NotFoundError("tenant not found");
      return result;
    }
    case "createPlatformFeatureFlag":
      return createFeatureFlag(input(args), context, deps.featureFlags);
    case "updatePlatformFeatureFlag": {
      const payload = input(args);
      const id = requiredString(payload, "id");
      const { id: _id, ...update } = payload;
      const result = await updateFeatureFlag(id, update, context, deps.featureFlags);
      if (!result) throw new NotFoundError("feature flag not found");
      return result;
    }
    case "createFirstAdminBootstrap":
      return createFirstAdminBootstrap(input(args), context, {
        ...deps.bootstrap,
        invitePort: deps.bootstrap?.invitePort ?? createCognitoFirstAdminInvitePort(),
      });
    case "resendFirstAdminBootstrapInvite": { const tenantId=requiredString(args, "tenantId"); const result=await resendFirstAdminBootstrapInvite(tenantId, context, {
        ...deps.bootstrap,
        invitePort: deps.bootstrap?.invitePort ?? createCognitoFirstAdminInvitePort(),
      }); await appendAuditLog({actorId:context.authContext?.user?.id,tenantId,action:firstAdminInviteAuditAction(result.status),entityType:"FIRST_ADMIN_BOOTSTRAP",entityId:result.id,details:{status:result.status,email:result.adminEmail}},deps.auditLogs); return result; }
    case "completeFirstAdminBootstrap": {
      const result = await completeFirstAdminBootstrap(requiredString(args, "tenantId"), { inviteId: args.inviteId }, context, deps.bootstrap);
      if (!result) throw new NotFoundError("first admin bootstrap not found");
      return result;
    }
    case "setTenantEntitlement":
      return setTenantEntitlement(input(args), context, deps.entitlements);
    case "setPlatformIntegration":
      return setPlatformIntegration(input(args), context, deps.integrations);
    default:
      throw new NotFoundError(`unsupported platform GraphQL field: ${event.info.fieldName}`);
  }
}

const AUDITED_MUTATIONS: Record<string, { action: string; entityType: string }> = {
  createTenant: { action: "TENANT_CREATED", entityType: "TENANT" },
  updateTenant: { action: "TENANT_UPDATED", entityType: "TENANT" },
  deactivateTenant: { action: "TENANT_DEACTIVATED", entityType: "TENANT" },
  activateTenant: { action: "TENANT_ACTIVATED", entityType: "TENANT" },
  suspendTenant: { action: "TENANT_SUSPENDED", entityType: "TENANT" },
  requestTenantDeletion: { action: "TENANT_DELETION_REQUESTED", entityType: "TENANT" },
  confirmTenantDeletion: { action: "TENANT_DELETION_CONFIRMED", entityType: "TENANT" },
  createPlatformFeatureFlag: { action: "FEATURE_FLAG_CREATED", entityType: "FEATURE_FLAG" },
  updatePlatformFeatureFlag: { action: "FEATURE_FLAG_UPDATED", entityType: "FEATURE_FLAG" },
  createFirstAdminBootstrap: { action: "TENANT_ADMIN_BOOTSTRAP_CREATED", entityType: "FIRST_ADMIN_BOOTSTRAP" },
  completeFirstAdminBootstrap: { action: "TENANT_ADMIN_BOOTSTRAP_COMPLETED", entityType: "FIRST_ADMIN_BOOTSTRAP" },
  setTenantEntitlement: { action: "TENANT_ENTITLEMENT_CHANGED", entityType: "TENANT_ENTITLEMENT" },
  setPlatformIntegration: { action: "PLATFORM_INTEGRATION_CHANGED", entityType: "PLATFORM_INTEGRATION" },
};

export async function handlePlatformGraphql(event: PlatformGraphqlEvent, deps: PlatformGraphqlDeps = {}): Promise<unknown> {
  const result = await executePlatformGraphql(event, deps);
  const audit = AUDITED_MUTATIONS[event.info.fieldName];
  if (!audit) return result;
  const context = createPlatformGraphqlContext(event);
  const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
  await appendAuditLog({
    actorId: context.authContext?.user?.id,
    tenantId: typeof record.tenantId === "string" ? record.tenantId : typeof record.id === "string" && audit.entityType === "TENANT" ? record.id : undefined,
    action: audit.action,
    entityType: audit.entityType,
    entityId: typeof record.id === "string" ? record.id : typeof record.tenantId === "string" ? record.tenantId : undefined,
    details: { requestId: context.requestId },
  }, deps.auditLogs);
  return result;
}

export async function handler(event: PlatformGraphqlEvent): Promise<unknown> {
  try {
    await hydratePlatformRuntimeConfig();
    return await handlePlatformGraphql(event);
  } catch (error) {
    throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]);
  }
}
