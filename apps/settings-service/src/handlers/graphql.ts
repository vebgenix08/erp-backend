import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import { academicYearPermissions } from "../modules/academic-years/academic-years.permissions";
import { activateAcademicYear, closeAcademicYear, createAcademicYear, listAcademicYears, reopenAcademicYear, updateAcademicYear } from "../modules/academic-years/academic-years.service";
import { campusPermissions } from "../modules/campuses/campuses.permissions";
import { createCampus, deactivateCampus, listCampuses, reactivateCampus, updateCampus } from "../modules/campuses/campuses.service";
import { campusAcademicUnitPermissions, createCampusAcademicUnit, listCampusAcademicUnits, updateCampusAcademicUnit } from "../modules/campus-academic-units/campus-academic-units.service";
import { institutionPermissions } from "../modules/institution/institution.permissions";
import { getInstitutionProfile, updateInstitutionProfile } from "../modules/institution/institution.service";
import { templatePermissions } from "../modules/templates/templates.permissions";
import { archiveTemplate, createTemplate, listTemplates, publishTemplate, updateTemplate } from "../modules/templates/templates.service";
import { numberingPermissions } from "../modules/numbering/numbering.permissions";
import { listNumberingPolicies, saveNumberingPolicy } from "../modules/numbering/numbering.service";
import { notificationPolicyPermissions } from "../modules/notification-policy/notification-policy.permissions";
import { getNotificationPolicy, updateNotificationPolicy } from "../modules/notification-policy/notification-policy.service";
import { hydrateSettingsRuntimeConfig } from "./runtime-config";
import { adminDashboardPermissions } from "../modules/admin-dashboard/admin-dashboard.permissions";
import { getAdminDashboard } from "../modules/admin-dashboard/admin-dashboard.service";
import { createCampusSetup } from "../modules/campus-setup/campus-setup.service";

interface AppSyncIdentity { sub?: string; claims?: Record<string, unknown>; }
export interface SettingsGraphqlEvent {
  info: { fieldName: string };
  arguments?: Record<string, unknown>;
  identity?: AppSyncIdentity | null;
  request?: { headers?: Record<string, string> };
}

const TENANT_ADMIN_SETUP_PERMISSIONS = [
  ...Object.values(institutionPermissions),
  ...Object.values(campusPermissions),
  ...Object.values(campusAcademicUnitPermissions),
  ...Object.values(academicYearPermissions),
  ...Object.values(templatePermissions),
  ...Object.values(numberingPermissions),
  ...Object.values(notificationPolicyPermissions),
  ...Object.values(adminDashboardPermissions),
];

function claim(claims: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = claims[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function createSettingsGraphqlContext(event: SettingsGraphqlEvent): RequestContext {
  const claims = event.identity?.claims ?? {};
  const groupsValue = claims["cognito:groups"];
  const groups = Array.isArray(groupsValue) ? groupsValue : typeof groupsValue === "string" ? groupsValue.split(",") : [];
  const role = claim(claims, "custom:role", "role") ?? (groups.includes("TENANT_ADMIN") ? "TENANT_ADMIN" : undefined);
  const userId = event.identity?.sub ?? claim(claims, "sub");
  const tenantId = claim(claims, "custom:tenantId", "tenantId");
  if (!userId || !tenantId) throw new ForbiddenError("authenticated tenant identity is required");
  const permissions = normalizePermissions([
    ...(role === "TENANT_ADMIN" ? TENANT_ADMIN_SETUP_PERMISSIONS : []),
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
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  }
  return args.input as Record<string, unknown>;
}

function requiredId(args: Record<string, unknown>, field = "id"): string {
  if (typeof args[field] !== "string" || !args[field].trim()) throw new ValidationError([{ field, message: `${field} is required` }]);
  return args[field].trim();
}
function filter(args: Record<string, unknown>) {
  return args.filter && typeof args.filter === "object" && !Array.isArray(args.filter) ? args.filter : undefined;
}

function templateInput(args: Record<string, unknown>): Record<string, unknown> {
  const payload = input(args);
  const parsed = { ...payload };
  for (const property of ["fields", "sections"] as const) {
    if (typeof payload[property] === "string") {
      try { parsed[property] = JSON.parse(payload[property] as string); }
      catch { throw new ValidationError([{ field: `input.${property}`, message: `${property} must be valid JSON` }]); }
    }
  }
  return parsed;
}

export async function handleSettingsGraphql(event: SettingsGraphqlEvent): Promise<unknown> {
  const context = createSettingsGraphqlContext(event);
  const args = event.arguments ?? {};
  switch (event.info.fieldName) {
    case "institutionProfile": return getInstitutionProfile(context);
    case "campuses": return listCampuses(context, undefined, { ...(typeof args.status === "string" ? { status: args.status as "ACTIVE" | "INACTIVE" } : {}), ...(typeof args.search === "string" ? { search: args.search } : {}) });
    case "campusAcademicUnits": return listCampusAcademicUnits(context, filter(args));
    case "academicYears": return listAcademicYears(context, undefined, typeof args.status === "string" ? { status: args.status as "DRAFT" | "ACTIVE" | "CLOSED" } : undefined);
    case "tenantAdminDashboard": return getAdminDashboard(input(args), context);
    case "tenantTemplates": return listTemplates(context, undefined, { ...(typeof args.status === "string" ? { status: args.status } : {}), ...(typeof args.templateType === "string" ? { templateType: args.templateType } : {}), ...(typeof args.search === "string" ? { search: args.search } : {}) });
    case "numberingPolicies": return listNumberingPolicies(context);
    case "notificationPolicy": return getNotificationPolicy(context);
    case "updateInstitutionProfile": return updateInstitutionProfile(input(args), context);
    case "createCampus": return createCampus(context, input(args));
    case "createCampusSetup": return createCampusSetup(context, input(args));
    case "createCampusAcademicUnit": return createCampusAcademicUnit(context, requiredId(args, "campusId"), input(args));
    case "updateCampusAcademicUnit": {
      const result = await updateCampusAcademicUnit(context, requiredId(args), input(args));
      if (!result) throw new NotFoundError("academic unit not found");
      return result;
    }
    case "updateCampus": {
      const result = await updateCampus(context, requiredId(args), input(args));
      if (!result) throw new NotFoundError("campus not found");
      return result;
    }
    case "deactivateCampus": {
      const result = await deactivateCampus(context, requiredId(args));
      if (!result) throw new NotFoundError("campus not found");
      return result;
    }
    case "reactivateCampus": {
      const result = await reactivateCampus(context, requiredId(args));
      if (!result) throw new NotFoundError("campus not found");
      return result;
    }
    case "createAcademicYear": return createAcademicYear(context, input(args));
    case "updateAcademicYear": {
      const result = await updateAcademicYear(context, requiredId(args), input(args));
      if (!result) throw new NotFoundError("academic year not found");
      return result;
    }
    case "activateAcademicYear": {
      const result = await activateAcademicYear(context, requiredId(args));
      if (!result) throw new NotFoundError("academic year not found");
      return result;
    }
    case "closeAcademicYear": { const result=await closeAcademicYear(context,requiredId(args),args.reason);if(!result)throw new NotFoundError("academic year not found");return result; }
    case "reopenAcademicYear": { const result=await reopenAcademicYear(context,requiredId(args),args.reason);if(!result)throw new NotFoundError("academic year not found");return result; }
    case "createTenantTemplate": return createTemplate({ ...templateInput(args), code: `TPL-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }, context);
    case "updateTenantTemplate": { const result=await updateTemplate(requiredId(args),templateInput(args),context);if(!result)throw new NotFoundError("template not found");return result; }
    case "publishTenantTemplate": { const result=await publishTemplate(requiredId(args),context);if(!result)throw new NotFoundError("template not found");return result; }
    case "archiveTenantTemplate": return archiveTemplate(requiredId(args),context);
    case "saveNumberingPolicy": return saveNumberingPolicy(input(args), context);
    case "updateNotificationPolicy": return updateNotificationPolicy(input(args), context);
    default: throw new NotFoundError(`unsupported settings GraphQL field: ${event.info.fieldName}`);
  }
}

export async function handler(event: SettingsGraphqlEvent): Promise<unknown> {
  try {
    await hydrateSettingsRuntimeConfig();
    return await handleSettingsGraphql(event);
  } catch (error) {
    console.error("Settings GraphQL request failed", {
      fieldName: event.info.fieldName,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]);
  }
}
