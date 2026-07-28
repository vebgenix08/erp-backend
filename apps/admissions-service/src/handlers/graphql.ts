import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  toGraphqlError,
  ValidationError,
} from "@school-erp/errors";
import {
  createRuntimeEventPublisher,
  type EventPublisher,
} from "@school-erp/events";
import {
  closeEnquiry,
  createEnquiry,
  getEnquiry,
  listEnquiries,
  listEnquiryPage,
  updateEnquiry,
} from "../modules/enquiry/enquiry.service";
import { enquiryPermissions } from "../modules/enquiry/enquiry.permissions";
import { applicationPermissions } from "../modules/application/application.permissions";
import {
  approveApplication,
  cancelApplication,
  checkApplicationDuplicates,
  confirmApplication,
  createApplication,
  getApplication,
  listApplications,
  listApplicationPage,
  rejectApplication,
  submitApplication,
  updateApplication,
} from "../modules/application/application.service";
import { hydrateAdmissionsRuntimeConfig } from "./runtime-config";

interface Event {
  info: { fieldName: string };
  arguments?: Record<string, unknown>;
  identity?: { sub?: string; claims?: Record<string, unknown> } | null;
  request?: { headers?: Record<string, string> };
}
function claim(claims: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = claims[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}
function context(event: Event): RequestContext {
  const claims = event.identity?.claims ?? {},
    groupsValue = claims["cognito:groups"],
    groups = Array.isArray(groupsValue)
      ? groupsValue
      : typeof groupsValue === "string"
        ? groupsValue.split(",")
        : [],
    role =
      claim(claims, "custom:role", "role") ??
      (groups.includes("TENANT_ADMIN") ? "TENANT_ADMIN" : undefined),
    userId = event.identity?.sub ?? claim(claims, "sub"),
    tenantId = claim(claims, "custom:tenantId", "tenantId");
  if (!userId || !tenantId)
    throw new ForbiddenError("authenticated tenant identity is required");
  const permissions = normalizePermissions([
    ...(role === "TENANT_ADMIN"
      ? [
          ...Object.values(enquiryPermissions),
          ...Object.values(applicationPermissions),
        ]
      : []),
    ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions),
  ]);
  return {
    requestId:
      event.request?.headers?.["x-amzn-trace-id"] ??
      `gql_${crypto.randomUUID()}`,
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
      user: {
        id: userId,
        email: claim(claims, "email"),
        role,
        permissions,
        source: "jwt-claims",
      },
    },
  };
}
function input(args: Record<string, unknown>) {
  if (
    !args.input ||
    typeof args.input !== "object" ||
    Array.isArray(args.input)
  )
    throw new ValidationError([
      { field: "input", message: "input is required" },
    ]);
  const payload = { ...(args.input as Record<string, unknown>) };
  if (typeof payload.customFields === "string") {
    try {
      payload.customFields = JSON.parse(payload.customFields);
    } catch {
      throw new ValidationError([
        {
          field: "input.customFields",
          message: "customFields must be valid JSON",
        },
      ]);
    }
  }
  return payload;
}
function id(args: Record<string, unknown>) {
  if (typeof args.id !== "string" || !args.id.trim())
    throw new ValidationError([{ field: "id", message: "id is required" }]);
  return args.id.trim();
}
export async function handleAdmissionsGraphql(
  event: Event,
  eventPublisher?: EventPublisher,
) {
  const ctx = context(event),
    args = event.arguments ?? {},
    serviceContext = {
      tenantContext: ctx.tenantContext!,
      authContext: ctx.authContext!,
      requestId: ctx.requestId,
    };
  switch (event.info.fieldName) {
    case "enquiries":
      return listEnquiries(serviceContext, undefined, args.filter as never);
    case "enquiryPage":
      return listEnquiryPage(serviceContext, undefined, args.filter as never);
    case "enquiry": {
      const value = await getEnquiry(id(args), serviceContext);
      if (!value) throw new NotFoundError("enquiry not found");
      return value;
    }
    case "createEnquiry":
      return createEnquiry(input(args), serviceContext);
    case "updateEnquiry": {
      const value = await updateEnquiry(id(args), input(args), serviceContext);
      if (!value) throw new NotFoundError("enquiry not found");
      return value;
    }
    case "closeEnquiry": {
      const value = await closeEnquiry(id(args), serviceContext);
      if (!value) throw new NotFoundError("enquiry not found");
      return value;
    }
    case "applications":
      return listApplications(serviceContext, undefined, args.filter as never);
    case "applicationPage":
      return listApplicationPage(serviceContext, undefined, args.filter as never);
    case "application":
      return getApplication(id(args), serviceContext);
    case "applicationDuplicateCheck":
      return checkApplicationDuplicates(id(args), serviceContext);
    case "createApplication":
      return createApplication(input(args), serviceContext);
    case "updateApplication":
      return updateApplication(id(args), input(args), serviceContext);
    case "submitApplication":
      return submitApplication(id(args), serviceContext);
    case "approveApplication":
      return approveApplication(id(args), args.input ?? {}, serviceContext);
    case "rejectApplication":
      return rejectApplication(id(args), args.input ?? {}, serviceContext);
    case "cancelApplication":
      return cancelApplication(id(args), args.input ?? {}, serviceContext);
    case "confirmApplication":
      return confirmApplication(id(args), args.input ?? {}, serviceContext, {
        eventPublisher,
      });
    default:
      throw new NotFoundError(
        `unsupported admissions GraphQL field: ${event.info.fieldName}`,
      );
  }
}
export async function handler(event: Event) {
  try {
    await hydrateAdmissionsRuntimeConfig();
    return await handleAdmissionsGraphql(
      event,
      createRuntimeEventPublisher("erp.admissions"),
    );
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error(JSON.stringify({
        level: "error",
        service: "admissions-service",
        operation: event.info?.fieldName ?? "unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }));
    }
    throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]);
  }
}
