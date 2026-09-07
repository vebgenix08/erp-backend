import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { createTenantContext } from "@school-erp/tenancy";
import { identityRouter } from "../../routes";

export interface IdentityHttpApiEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    requestId?: string;
    http?: { method?: string; path?: string };
    authorizer?: { jwt?: { claims?: Record<string, string | undefined> } };
  };
}

function parseQuery(rawQueryString?: string) {
  return rawQueryString ? Object.fromEntries(new URLSearchParams(rawQueryString)) : {};
}

function parseBody(event: IdentityHttpApiEvent): unknown {
  if (!event.body) return undefined;
  const body = event.isBase64Encoded
    ? decodeURIComponent(
        Array.from(
          atob(event.body),
          (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
        ).join(""),
      )
    : event.body;
  return JSON.parse(body);
}

function claim(claims: Record<string, string | undefined>, ...names: string[]) {
  for (const name of names) {
    const value = claims[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function toIdentityApiRequest(event: IdentityHttpApiEvent): ApiRequest {
  const claims = event.requestContext?.authorizer?.jwt?.claims ?? {};
  const userId = claim(claims, "sub");
  const tenantId = claim(claims, "custom:tenantId", "tenantId");
  const role = claim(claims, "custom:role", "role");
  const tenantContext = tenantId
    ? createTenantContext({ tenantId, source: "jwt-claims", userId })
    : undefined;

  return {
    requestId: event.requestContext?.requestId,
    method: event.requestContext?.http?.method ?? "GET",
    path: event.rawPath ?? event.requestContext?.http?.path ?? "/",
    headers: event.headers,
    query: parseQuery(event.rawQueryString),
    body: parseBody(event),
    tenantContext,
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      tenant: tenantContext,
      requestId: event.requestContext?.requestId,
      user: userId
        ? {
            id: userId,
            email: claim(claims, "email"),
            role,
            permissions: normalizePermissions(claim(claims, "custom:permissions", "permissions")),
            source: "jwt-claims",
          }
        : undefined,
    },
  };
}

export function toHttpApiResponse(response: ApiResponse) {
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body === undefined ? "" : JSON.stringify(response.body),
  };
}

export async function handleIdentitySessionHttp(event: IdentityHttpApiEvent) {
  return toHttpApiResponse(await identityRouter.handle(toIdentityApiRequest(event)));
}

export function isIdentityHttpApiEvent(value: unknown): value is IdentityHttpApiEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as IdentityHttpApiEvent;
  return Boolean(event.requestContext?.http?.method);
}
