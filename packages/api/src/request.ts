import { BadRequestError } from "@school-erp/errors";
import type { ApiRequest, ApiMethod, CreateRequestContextOptions, RequestContext } from "./types";

function normalizeMethod(method: string | undefined, defaultMethod: ApiMethod = "GET"): ApiMethod {
  const normalized = (method ?? defaultMethod).toUpperCase();
  if (
    normalized === "GET" ||
    normalized === "POST" ||
    normalized === "PUT" ||
    normalized === "PATCH" ||
    normalized === "DELETE" ||
    normalized === "OPTIONS" ||
    normalized === "HEAD"
  ) {
    return normalized;
  }
  throw new BadRequestError(`unsupported method: ${method}`);
}

export function getHeaderValue(headers: ApiRequest["headers"], name: string): string | undefined {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function normalizeHeaders(headers: ApiRequest["headers"]): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function normalizeQuery(query: ApiRequest["query"]): Record<string, string | string[] | undefined> {
  return { ...(query ?? {}) };
}

export function parseJsonBody(body: string | undefined): unknown {
  if (body === undefined || body.trim().length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new BadRequestError("request body must be valid JSON");
  }
}

export function createRequestContext(request: ApiRequest, options: CreateRequestContextOptions = {}): RequestContext {
  const method = normalizeMethod(request.method, options.defaultMethod);
  return {
    requestId: request.requestId ?? options.requestId ?? `req_${Date.now()}`,
    tenantContext: request.tenantContext,
    authContext: request.authContext,
    path: request.path,
    method,
    headers: normalizeHeaders(request.headers),
    query: normalizeQuery(request.query),
    body: request.body ?? parseJsonBody(request.rawBody),
    params: {},
  };
}
