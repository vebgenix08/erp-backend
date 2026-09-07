import type { RequestContext } from "@school-erp/api";
import { normalizePermissions, requirePermission } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import { createLogger } from "@school-erp/logger";
import { accessPermissions } from "../modules/access/access.permissions";
import {
  assignUserRole,
  bootstrapCurrentTenantAdmin,
  getAccessSnapshot,
  getAssignmentPage,
  revokeUserRole,
  saveRolePermissions,
} from "../modules/access/access.service";
import { rolePermissions } from "../modules/roles/roles.permissions";
import { createRole, listRolePage, listRoles, updateRole } from "../modules/roles/roles.service";
import { userPermissions } from "../modules/users/users.permissions";
import { listUserPage, listUsers } from "../modules/users/users.service";
import { hydrateIdentityRuntimeConfig } from "./runtime-config";
import { CognitoStaffIdentityGateway } from "./cognito-staff-identity";
import { identityAuditRepository } from "../modules/access/identity-audit.repository";
import { employeePermissions } from "../modules/employees/employees.permissions";
import {
  createEmployee,
  deactivateEmployee,
  getEmployee,
  listEmployeeInviteAttempts,
  listEmployeeInviteDeliveryEvents,
  listEmployeePage,
  listEmployees,
  reactivateEmployee,
  resendEmployeeInvite,
  resolveEmployeeByPrincipal,
  updateEmployee,
} from "../modules/employees/employees.service";
import { employeeRepository } from "../modules/employees/employees.repository";
import { resolvePrincipalAuthorization } from "../modules/access/authorization.service";
import { readIdentityDashboardSlice } from "../modules/admin-dashboard/admin-dashboard-slice.repository";
import {
  handleIdentitySessionHttp,
  isIdentityHttpApiEvent,
} from "../modules/session/session-http.adapter";

interface AppSyncIdentity {
  sub?: string;
  claims?: Record<string, unknown>;
}

const logger = createLogger("identity-service");
export interface IdentityGraphqlEvent {
  info: { fieldName: string };
  arguments?: Record<string, unknown>;
  identity?: AppSyncIdentity | null;
  request?: { headers?: Record<string, string> };
  source?: string;
  operation?: string;
  payload?: Record<string, unknown>;
}

const TENANT_ADMIN_PERMISSIONS = [
  ...Object.values(userPermissions),
  ...Object.values(rolePermissions),
  ...Object.values(accessPermissions),
  ...Object.values(employeePermissions),
];

function claim(claims: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = claims[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function createIdentityGraphqlContext(event: IdentityGraphqlEvent): RequestContext {
  const claims = event.identity?.claims ?? {};
  const groupsValue = claims["cognito:groups"];
  const groups = Array.isArray(groupsValue)
    ? groupsValue
    : typeof groupsValue === "string"
      ? groupsValue.split(",")
      : [];
  const role =
    claim(claims, "custom:role", "role") ??
    (groups.includes("TENANT_ADMIN") ? "TENANT_ADMIN" : undefined);
  const userId = event.identity?.sub ?? claim(claims, "sub");
  const tenantId = claim(claims, "custom:tenantId", "tenantId");
  if (!userId || !tenantId) throw new ForbiddenError("authenticated tenant identity is required");
  const permissions = normalizePermissions([
    ...(role === "TENANT_ADMIN" ? TENANT_ADMIN_PERMISSIONS : []),
    ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions),
  ]);
  return {
    requestId: event.request?.headers?.["x-amzn-trace-id"] ?? `gql_${crypto.randomUUID()}`,
    path: `graphql:${event.info.fieldName}`,
    method: "POST",
    headers: event.request?.headers ?? {},
    query: {},
    body: event.arguments ?? {},
    params: {},
    tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      user: { id: userId, email: claim(claims, "email"), role, permissions, source: "jwt-claims" },
    },
  };
}

function input(args: Record<string, unknown>): Record<string, unknown> {
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input))
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  return args.input as Record<string, unknown>;
}
function requiredId(args: Record<string, unknown>): string {
  if (typeof args.id !== "string" || !args.id.trim())
    throw new ValidationError([{ field: "id", message: "id is required" }]);
  return args.id.trim();
}

export async function handleIdentityGraphql(event: IdentityGraphqlEvent): Promise<unknown> {
  const context = createIdentityGraphqlContext(event);
  if (context.authContext?.user?.role === "TENANT_ADMIN") {
    await bootstrapCurrentTenantAdmin(context);
  }
  const resolvedAuthorization = await resolvePrincipalAuthorization(
    context.tenantContext!.tenantId!,
    context.authContext!.user!.id,
  );
  context.authContext!.user = resolvedAuthorization
    ? {
        ...context.authContext!.user!,
        role: resolvedAuthorization.role,
        roles: resolvedAuthorization.roles,
        scopes: resolvedAuthorization.scopes,
        permissions: resolvedAuthorization.permissions as never,
      }
    : {
        ...context.authContext!.user!,
        role: undefined,
        roles: [],
        scopes: [],
        permissions: [],
      };
  const args = event.arguments ?? {};
  const runtime =
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env ?? {};
  const userPoolId = runtime.COGNITO_USER_POOL_ID?.trim();
  const employeeDeps = userPoolId
    ? { identityGateway: new CognitoStaffIdentityGateway(userPoolId, runtime.AWS_REGION) }
    : {};
  switch (event.info.fieldName) {
    case "identityUsers":
      requirePermission(context.authContext, userPermissions.list);
      await bootstrapCurrentTenantAdmin(context);
      return listUsers(context.tenantContext);
    case "identityUserPage":
      requirePermission(context.authContext, userPermissions.list);
      await bootstrapCurrentTenantAdmin(context);
      return listUserPage(context.tenantContext, (args.filter ?? {}) as never);
    case "identityRoles":
      requirePermission(context.authContext, rolePermissions.list);
      return listRoles(context.tenantContext);
    case "identityRolePage":
      requirePermission(context.authContext, rolePermissions.list);
      return listRolePage(context.tenantContext, (args.filter ?? {}) as never);
    case "identityAccess":
      return getAccessSnapshot(context);
    case "identityAssignmentPage":
      return getAssignmentPage((args.filter ?? {}) as never, context);
    case "employees":
      return listEmployees(context, employeeDeps, args.filter as never);
    case "employeePage":
      return listEmployeePage(context, employeeDeps, args.filter as never);
    case "employee":
      return getEmployee(requiredId(args), context, employeeDeps);
    case "employeeInviteAttempts":
      return listEmployeeInviteAttempts(requiredId(args), context, employeeDeps);
    case "employeeInviteDeliveryEvents":
      return listEmployeeInviteDeliveryEvents(requiredId(args), context, employeeDeps);
    case "createEmployee": {
      const payload = input(args);
      if (typeof payload.customFields === "string") {
        try {
          payload.customFields = JSON.parse(payload.customFields);
        } catch {
          throw new ValidationError([
            { field: "input.customFields", message: "customFields must be valid JSON" },
          ]);
        }
      }
      return createEmployee(payload, context, employeeDeps);
    }
    case "updateEmployee": {
      const payload = input(args);
      if (typeof payload.customFields === "string") {
        try {
          payload.customFields = JSON.parse(payload.customFields);
        } catch {
          throw new ValidationError([
            { field: "input.customFields", message: "customFields must be valid JSON" },
          ]);
        }
      }
      return updateEmployee(requiredId(args), payload, context, employeeDeps);
    }
    case "resendEmployeeInvite":
      return resendEmployeeInvite(requiredId(args), context, employeeDeps);
    case "deactivateEmployee":
      return deactivateEmployee(requiredId(args), context, employeeDeps);
    case "reactivateEmployee":
      return reactivateEmployee(requiredId(args), context, employeeDeps);
    case "createIdentityRole": {
      requirePermission(context.authContext, rolePermissions.create);
      const result = await createRole(context.tenantContext, input(args));
      if (!result) throw new NotFoundError("created role could not be loaded");
      await (
        await identityAuditRepository()
      ).append({
        id: `identity_audit_${crypto.randomUUID()}`,
        tenantId: context.tenantContext!.tenantId!,
        actorId: context.authContext!.user!.id,
        action: "ROLE_CREATED",
        entityType: "ROLE",
        entityId: result.id,
        details: { code: result.code, name: result.name },
        createdAt: new Date(),
      });
      return result;
    }
    case "updateIdentityRole": {
      requirePermission(context.authContext, rolePermissions.update);
      const result = await updateRole(context.tenantContext, requiredId(args), input(args));
      if (!result) throw new NotFoundError("role not found");
      await (
        await identityAuditRepository()
      ).append({
        id: `identity_audit_${crypto.randomUUID()}`,
        tenantId: context.tenantContext!.tenantId!,
        actorId: context.authContext!.user!.id,
        action: "ROLE_UPDATED",
        entityType: "ROLE",
        entityId: result.id,
        details: { name: result.name, isActive: result.isActive },
        createdAt: new Date(),
      });
      return result;
    }
    case "deactivateIdentityRole": {
      requirePermission(context.authContext, rolePermissions.deactivate);
      const result = await updateRole(context.tenantContext, requiredId(args), { isActive: false });
      if (!result) throw new NotFoundError("role not found");
      await (
        await identityAuditRepository()
      ).append({
        id: `identity_audit_${crypto.randomUUID()}`,
        tenantId: context.tenantContext!.tenantId!,
        actorId: context.authContext!.user!.id,
        action: "ROLE_DEACTIVATED",
        entityType: "ROLE",
        entityId: result.id,
        createdAt: new Date(),
      });
      return result;
    }
    case "assignIdentityUserRole":
      return assignUserRole(input(args), context);
    case "revokeIdentityUserRole": {
      const result = await revokeUserRole(requiredId(args), context);
      if (!result) throw new NotFoundError("role assignment not found");
      return result;
    }
    case "saveIdentityRolePermissions":
      return saveRolePermissions(input(args), context);
    default:
      throw new NotFoundError(`unsupported identity GraphQL field: ${event.info.fieldName}`);
  }
}

export async function handler(event: IdentityGraphqlEvent | unknown): Promise<unknown> {
  if (isIdentityHttpApiEvent(event)) {
    await hydrateIdentityRuntimeConfig();
    return handleIdentitySessionHttp(event);
  }
  const graphqlEvent = event as IdentityGraphqlEvent;
  try {
    await hydrateIdentityRuntimeConfig();
    if (graphqlEvent.source === "erp.internal") {
      const tenantId = graphqlEvent.payload?.tenantId;
      if (typeof tenantId !== "string" || !tenantId.trim()) {
        throw new ValidationError([{ field: "tenantId", message: "tenantId is required" }]);
      }
      if (graphqlEvent.operation === "GET_EMPLOYEES") {
        const ids = graphqlEvent.payload?.employeeIds;
        if (
          !Array.isArray(ids) ||
          ids.length > 100 ||
          ids.some((id) => typeof id !== "string" || !id.trim())
        ) {
          throw new ValidationError([
            { field: "employeeIds", message: "up to 100 valid employee identifiers are required" },
          ]);
        }
        if (!employeeRepository.getMany) throw new Error("Employee batch lookup is unavailable");
        return {
          result: await employeeRepository.getMany(tenantId.trim(), [
            ...new Set(ids.map((id) => String(id).trim())),
          ]),
        };
      }
      if (graphqlEvent.operation === "GET_EMPLOYEE") {
        const employeeId = graphqlEvent.payload?.employeeId;
        if (typeof employeeId !== "string" || !employeeId.trim()) {
          throw new ValidationError([{ field: "employeeId", message: "employeeId is required" }]);
        }
        const employee = await employeeRepository.get(tenantId.trim(), employeeId.trim());
        if (!employee) throw new NotFoundError("employee was not found");
        return { result: employee };
      }
      if (graphqlEvent.operation === "GET_EMPLOYEE_BY_PRINCIPAL") {
        const principalId = graphqlEvent.payload?.principalId;
        if (typeof principalId !== "string" || !principalId.trim()) {
          throw new ValidationError([{ field: "principalId", message: "principalId is required" }]);
        }
        const employee = await resolveEmployeeByPrincipal(tenantId, principalId);
        return { result: employee };
      }
      if (graphqlEvent.operation === "GET_ADMIN_DASHBOARD_SLICE") {
        const scope = graphqlEvent.payload?.scope;
        if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
          throw new ValidationError([{ field: "scope", message: "scope is required" }]);
        }
        return {
          result: await readIdentityDashboardSlice(tenantId.trim(), scope as never),
        };
      }
      if (graphqlEvent.operation === "RESOLVE_AUTHORIZATION") {
        const principalId = graphqlEvent.payload?.principalId;
        if (typeof principalId !== "string" || !principalId.trim()) {
          throw new ValidationError([{ field: "principalId", message: "principalId is required" }]);
        }
        return {
          result: await resolvePrincipalAuthorization(tenantId.trim(), principalId.trim()),
        };
      }
      throw new NotFoundError(`unsupported internal identity operation: ${graphqlEvent.operation}`);
    }
    return await handleIdentityGraphql(graphqlEvent);
  } catch (error) {
    const traceId = graphqlEvent.request?.headers?.["x-amzn-trace-id"];
    logger.error("Identity GraphQL request failed", {
      requestId: traceId,
      operation: graphqlEvent.info?.fieldName ?? graphqlEvent.operation ?? "unknown",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { errorStack: error.stack } : {}),
    });
    throw toGraphqlError(error, traceId);
  }
}
