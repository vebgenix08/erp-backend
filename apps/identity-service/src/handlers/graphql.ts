import type { RequestContext } from "@school-erp/api";
import { normalizePermissions, requirePermission } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import { accessPermissions } from "../modules/access/access.permissions";
import { assignUserRole, bootstrapCurrentTenantAdmin, getAccessSnapshot, getAssignmentPage, revokeUserRole, saveRolePermissions } from "../modules/access/access.service";
import { rolePermissions } from "../modules/roles/roles.permissions";
import { createRole, listRolePage, listRoles, updateRole } from "../modules/roles/roles.service";
import { userPermissions } from "../modules/users/users.permissions";
import { listUserPage, listUsers } from "../modules/users/users.service";
import { hydrateIdentityRuntimeConfig } from "./runtime-config";
import { CognitoStaffIdentityGateway } from "./cognito-staff-identity";
import { identityAuditRepository } from "../modules/access/identity-audit.repository";
import { employeePermissions } from "../modules/employees/employees.permissions";
import { createEmployee, deactivateEmployee, endEmployment, getEmployee, listEmployeeInviteAttempts, listEmployeeInviteDeliveryEvents, listEmployeePage, listEmployees, reactivateEmployee, resendEmployeeInvite, updateEmployee } from "../modules/employees/employees.service";

interface AppSyncIdentity { sub?: string; claims?: Record<string, unknown>; }
export interface IdentityGraphqlEvent { info: { fieldName: string }; arguments?: Record<string, unknown>; identity?: AppSyncIdentity | null; request?: { headers?: Record<string, string> }; }

const TENANT_ADMIN_PERMISSIONS = [...Object.values(userPermissions), ...Object.values(rolePermissions), ...Object.values(accessPermissions), ...Object.values(employeePermissions)];

function claim(claims: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) { const value = claims[name]; if (typeof value === "string" && value.trim()) return value.trim(); }
  return undefined;
}

export function createIdentityGraphqlContext(event: IdentityGraphqlEvent): RequestContext {
  const claims = event.identity?.claims ?? {};
  const groupsValue = claims["cognito:groups"];
  const groups = Array.isArray(groupsValue) ? groupsValue : typeof groupsValue === "string" ? groupsValue.split(",") : [];
  const role = claim(claims, "custom:role", "role") ?? (groups.includes("TENANT_ADMIN") ? "TENANT_ADMIN" : undefined);
  const userId = event.identity?.sub ?? claim(claims, "sub");
  const tenantId = claim(claims, "custom:tenantId", "tenantId");
  if (!userId || !tenantId) throw new ForbiddenError("authenticated tenant identity is required");
  const permissions = normalizePermissions([...(role === "TENANT_ADMIN" ? TENANT_ADMIN_PERMISSIONS : []), ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions)]);
  return { requestId: event.request?.headers?.["x-amzn-trace-id"] ?? `gql_${crypto.randomUUID()}`, path: `graphql:${event.info.fieldName}`, method: "POST", headers: event.request?.headers ?? {}, query: {}, body: event.arguments ?? {}, params: {}, tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: userId, email: claim(claims, "email"), role, permissions, source: "jwt-claims" } } };
}

function input(args: Record<string, unknown>): Record<string, unknown> {
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new ValidationError([{ field: "input", message: "input is required" }]);
  return args.input as Record<string, unknown>;
}
function requiredId(args: Record<string, unknown>): string {
  if (typeof args.id !== "string" || !args.id.trim()) throw new ValidationError([{ field: "id", message: "id is required" }]);
  return args.id.trim();
}

export async function handleIdentityGraphql(event: IdentityGraphqlEvent): Promise<unknown> {
  const context = createIdentityGraphqlContext(event); const args = event.arguments ?? {};
  const runtime = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const userPoolId = runtime.COGNITO_USER_POOL_ID?.trim();
  const employeeDeps = userPoolId ? { identityGateway: new CognitoStaffIdentityGateway(userPoolId, runtime.AWS_REGION) } : {};
  switch (event.info.fieldName) {
    case "identityUsers": requirePermission(context.authContext, userPermissions.list); await bootstrapCurrentTenantAdmin(context); return listUsers(context.tenantContext);
    case "identityUserPage": requirePermission(context.authContext,userPermissions.list);await bootstrapCurrentTenantAdmin(context);return listUserPage(context.tenantContext,(args.filter??{}) as never);
    case "identityRoles": requirePermission(context.authContext, rolePermissions.list); return listRoles(context.tenantContext);
    case "identityRolePage": requirePermission(context.authContext,rolePermissions.list);return listRolePage(context.tenantContext,(args.filter??{}) as never);
    case "identityAccess": return getAccessSnapshot(context);
    case "identityAssignmentPage": return getAssignmentPage((args.filter??{}) as never,context);
    case "employees": return listEmployees(context, employeeDeps, args.filter as never);
    case "employeePage": return listEmployeePage(context, employeeDeps, args.filter as never);
    case "employee": return getEmployee(requiredId(args), context, employeeDeps);
    case "employeeInviteAttempts": return listEmployeeInviteAttempts(requiredId(args), context, employeeDeps);
    case "employeeInviteDeliveryEvents": return listEmployeeInviteDeliveryEvents(requiredId(args), context, employeeDeps);
    case "createEmployee": { const payload=input(args);if(typeof payload.customFields==="string"){try{payload.customFields=JSON.parse(payload.customFields);}catch{throw new ValidationError([{field:"input.customFields",message:"customFields must be valid JSON"}]);}}return createEmployee(payload, context, employeeDeps); }
    case "updateEmployee": { const payload=input(args);if(typeof payload.customFields==="string"){try{payload.customFields=JSON.parse(payload.customFields);}catch{throw new ValidationError([{field:"input.customFields",message:"customFields must be valid JSON"}]);}}return updateEmployee(requiredId(args), payload, context, employeeDeps); }
    case "resendEmployeeInvite": return resendEmployeeInvite(requiredId(args), context, employeeDeps);
    case "endEmployment": return endEmployment(requiredId(args), typeof args.reason === "string" ? args.reason : "", context, employeeDeps);
    case "deactivateEmployee": return deactivateEmployee(requiredId(args), context, employeeDeps);
    case "reactivateEmployee": return reactivateEmployee(requiredId(args), context, employeeDeps);
    case "createIdentityRole": {requirePermission(context.authContext,rolePermissions.create);const result=await createRole(context.tenantContext,input(args));if(!result)throw new NotFoundError("created role could not be loaded");await(await identityAuditRepository()).append({id:`identity_audit_${crypto.randomUUID()}`,tenantId:context.tenantContext!.tenantId!,actorId:context.authContext!.user!.id,action:"ROLE_CREATED",entityType:"ROLE",entityId:result.id,details:{code:result.code,name:result.name},createdAt:new Date()});return result;}
    case "updateIdentityRole": {requirePermission(context.authContext,rolePermissions.update);const result=await updateRole(context.tenantContext,requiredId(args),input(args));if(!result)throw new NotFoundError("role not found");await(await identityAuditRepository()).append({id:`identity_audit_${crypto.randomUUID()}`,tenantId:context.tenantContext!.tenantId!,actorId:context.authContext!.user!.id,action:"ROLE_UPDATED",entityType:"ROLE",entityId:result.id,details:{name:result.name,isActive:result.isActive},createdAt:new Date()});return result;}
    case "deactivateIdentityRole": {requirePermission(context.authContext,rolePermissions.deactivate);const result=await updateRole(context.tenantContext,requiredId(args),{isActive:false});if(!result)throw new NotFoundError("role not found");await(await identityAuditRepository()).append({id:`identity_audit_${crypto.randomUUID()}`,tenantId:context.tenantContext!.tenantId!,actorId:context.authContext!.user!.id,action:"ROLE_DEACTIVATED",entityType:"ROLE",entityId:result.id,createdAt:new Date()});return result;}
    case "assignIdentityUserRole": return assignUserRole(input(args), context);
    case "revokeIdentityUserRole": { const result = await revokeUserRole(requiredId(args), context); if (!result) throw new NotFoundError("role assignment not found"); return result; }
    case "saveIdentityRolePermissions": return saveRolePermissions(input(args), context);
    default: throw new NotFoundError(`unsupported identity GraphQL field: ${event.info.fieldName}`);
  }
}

export async function handler(event: IdentityGraphqlEvent): Promise<unknown> {
  try { await hydrateIdentityRuntimeConfig(); return await handleIdentityGraphql(event); }
  catch (error) { throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]); }
}
