import { BadRequestError } from "@school-erp/errors";
import type { TenantType } from "@school-erp/types";
import { getTenantCodeFromHeaders, getTenantIdFromHeaders, getTenantSubdomain, normalizeTenantClaims } from "./helpers";
import type { TenantContext, TenantContextOptions, TenantRequestLike, TenantResolutionSource } from "./types";

function buildContext(partial: Partial<TenantContext> & Pick<TenantContext, "resolvedAt" | "source">): TenantContext {
  return {
    tenantId: partial.tenantId,
    tenantCode: partial.tenantCode,
    tenantType: partial.tenantType,
    source: partial.source,
    requestId: partial.requestId,
    userId: partial.userId,
    hostname: partial.hostname,
    resolvedAt: partial.resolvedAt,
  };
}

export function createTenantContext(
  input: Partial<TenantContext> & Pick<TenantContext, "source">,
): TenantContext {
  return buildContext({ ...input, resolvedAt: input.resolvedAt ?? new Date() });
}

export function resolveTenantFromRequest(
  request: TenantRequestLike = {},
  options: TenantContextOptions = {},
): TenantContext {
  const claims = normalizeTenantClaims(request.jwtClaims ?? request.claims);
  if (claims && (claims.tenantId || claims.tenantCode)) {
    return createTenantContext({
      tenantId: claims.tenantId,
      tenantCode: claims.tenantCode,
      tenantType: claims.tenantType,
      source: "jwt-claims",
      requestId: request.requestId,
      userId: request.userId,
      hostname: request.hostname ?? request.host,
    });
  }

  const tenantId = getTenantIdFromHeaders(request);
  if (tenantId) {
    return createTenantContext({
      tenantId,
      source: "x-tenant-id",
      requestId: request.requestId,
      userId: request.userId,
      hostname: request.hostname ?? request.host,
    });
  }

  const tenantCode = getTenantCodeFromHeaders(request);
  if (tenantCode) {
    return createTenantContext({
      tenantCode,
      source: "x-tenant-code",
      requestId: request.requestId,
      userId: request.userId,
      hostname: request.hostname ?? request.host,
    });
  }

  const subdomain = getTenantSubdomain(request);
  if (subdomain) {
    return createTenantContext({
      tenantCode: subdomain,
      source: "subdomain",
      requestId: request.requestId,
      userId: request.userId,
      hostname: request.hostname ?? request.host,
    });
  }

  return createTenantContext({
    source: options.defaultSource ?? "unknown",
    requestId: request.requestId,
    userId: request.userId,
    hostname: request.hostname ?? request.host,
  });
}

export function requireTenant(context: TenantContext | undefined): TenantContext {
  if (!context || !context.tenantId) {
    throw new BadRequestError("tenant context is required");
  }
  return context;
}

export function requireTenantId(context: TenantContext | undefined): string {
  return requireTenant(context).tenantId as string;
}

export function requireTenantCode(context: TenantContext | undefined): string {
  const value = context?.tenantCode?.trim();
  if (!value) {
    throw new BadRequestError("tenant code is required");
  }
  return value;
}

export function hasTenantId(context: TenantContext | undefined): context is TenantContext & { tenantId: string } {
  return Boolean(context?.tenantId?.trim());
}

export function hasTenantCode(context: TenantContext | undefined): context is TenantContext & { tenantCode: string } {
  return Boolean(context?.tenantCode?.trim());
}

export function getTenantResolutionSource(context: TenantContext | undefined): TenantResolutionSource {
  return context?.source ?? "unknown";
}

export type { TenantType };
