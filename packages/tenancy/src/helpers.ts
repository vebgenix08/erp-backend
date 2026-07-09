import type { TenantClaimsPlaceholder, TenantRequestLike } from "./types";

const TENANT_ID_HEADERS = ["x-tenant-id", "tenant-id"];
const TENANT_CODE_HEADERS = ["x-tenant-code", "tenant-code"];

function readHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  candidates: string[],
): string | undefined {
  if (!headers) return undefined;
  for (const candidate of candidates) {
    const value = headers[candidate] ?? headers[candidate.toLowerCase()];
    if (Array.isArray(value)) {
      const first = value[0]?.trim();
      if (first) return first;
      continue;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function normalizeTenantId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeTenantCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeTenantClaims(value: TenantClaimsPlaceholder | undefined): TenantClaimsPlaceholder | undefined {
  if (!value) return undefined;
  return {
    tenantId: normalizeTenantId(value.tenantId),
    tenantCode: normalizeTenantCode(value.tenantCode),
    tenantType: value.tenantType,
  };
}

export function getTenantIdFromHeaders(request: TenantRequestLike): string | undefined {
  return normalizeTenantId(readHeader(request.headers, TENANT_ID_HEADERS));
}

export function getTenantCodeFromHeaders(request: TenantRequestLike): string | undefined {
  return normalizeTenantCode(readHeader(request.headers, TENANT_CODE_HEADERS));
}

export function getTenantSubdomain(request: TenantRequestLike): string | undefined {
  if (typeof request.subdomain === "string" && request.subdomain.trim().length > 0) {
    return request.subdomain.trim().toLowerCase();
  }

  const hostname = request.hostname ?? request.host;
  if (!hostname) return undefined;
  const cleaned = hostname.trim().toLowerCase();
  if (!cleaned || cleaned === "localhost" || cleaned === "127.0.0.1") return undefined;

  const [subdomain] = cleaned.split(".");
  if (!subdomain || subdomain === "www") return undefined;
  return subdomain;
}

export function hasTenantHeaders(request: TenantRequestLike): boolean {
  return Boolean(getTenantIdFromHeaders(request) || getTenantCodeFromHeaders(request));
}
