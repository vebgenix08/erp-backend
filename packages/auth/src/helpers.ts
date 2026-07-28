import { BadRequestError } from "@school-erp/errors";
import { createTenantContext, resolveTenantFromRequest as resolveTenantContextFromRequest, type TenantContext, type TenantRequestLike } from "@school-erp/tenancy";
import type { AuthJwtClaimsPlaceholder, AuthRequestLike, AuthUser, CognitoIntegrationConfig, CognitoVerificationResult, Permission } from "./types";
import { verifyCognitoJwt } from "./cognito";

const USER_ID_HEADERS = ["x-user-id"];
const USER_EMAIL_HEADERS = ["x-user-email"];
const USER_ROLE_HEADERS = ["x-user-role"];
const USER_PERMISSIONS_HEADERS = ["x-user-permissions"];

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

export function normalizePermission(value: unknown): Permission | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+){2}$/.test(normalized)) return null;
  return normalized as Permission;
}

export function normalizePermissions(value: unknown): Permission[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const normalized = normalizePermission(entry);
      return normalized ? [normalized] : [];
    });
  }

  if (typeof value === "string") {
    return value
      .split(/[,\s]+/g)
      .map((entry) => normalizePermission(entry))
      .filter((entry): entry is Permission => Boolean(entry));
  }

  return [];
}

export function normalizeAuthClaims(value: AuthJwtClaimsPlaceholder | undefined): AuthJwtClaimsPlaceholder | undefined {
  if (!value) return undefined;
  return {
    sub: typeof value.sub === "string" ? value.sub.trim() || undefined : undefined,
    email: typeof value.email === "string" ? value.email.trim() || undefined : undefined,
    role: typeof value.role === "string" ? value.role.trim() || undefined : undefined,
    permissions: Array.isArray(value.permissions) ? value.permissions : typeof value.permissions === "string" ? value.permissions.split(/[,\s]+/g) : undefined,
    tenantId: typeof value.tenantId === "string" ? value.tenantId.trim() || undefined : undefined,
    tenantCode: typeof value.tenantCode === "string" ? value.tenantCode.trim() || undefined : undefined,
  };
}

export function getUserIdFromHeaders(request: AuthRequestLike): string | undefined {
  return readHeader(request.headers, USER_ID_HEADERS);
}

export function getUserEmailFromHeaders(request: AuthRequestLike): string | undefined {
  return readHeader(request.headers, USER_EMAIL_HEADERS)?.toLowerCase();
}

export function getUserRoleFromHeaders(request: AuthRequestLike): string | undefined {
  return readHeader(request.headers, USER_ROLE_HEADERS)?.toUpperCase();
}

export function getUserPermissionsFromHeaders(request: AuthRequestLike): Permission[] {
  return normalizePermissions(readHeader(request.headers, USER_PERMISSIONS_HEADERS));
}

export function getBearerToken(request: AuthRequestLike): string | undefined {
  const explicit = request.bearerToken?.trim();
  if (explicit) return explicit;
  const header = readHeader(request.headers, ["authorization", "Authorization"]);
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || undefined;
}

export function buildTenantContext(request: AuthRequestLike): TenantContext | undefined {
  if (request.tenantId || request.headers?.["x-tenant-id"]) {
    const tenantRequest: TenantRequestLike = {
      ...request,
      headers: request.headers,
    };
    return resolveTenantContextFromRequest(tenantRequest);
  }
  const claims = normalizeAuthClaims(request.jwtClaims ?? request.claims);
  if (claims?.tenantId || claims?.tenantCode) {
    return createTenantContext({
      source: "jwt-claims",
      tenantId: claims.tenantId,
      tenantCode: claims.tenantCode,
    });
  }
  return undefined;
}

export function buildAuthUser(request: AuthRequestLike, claims: AuthJwtClaimsPlaceholder | undefined): AuthUser | undefined {
  const id = claims?.sub ?? getUserIdFromHeaders(request) ?? request.userId;
  if (!id) {
    return undefined;
  }

  const email = claims?.email ?? getUserEmailFromHeaders(request) ?? request.userEmail;
  const role = claims?.role ?? getUserRoleFromHeaders(request) ?? request.userRole;
  const permissions = [
    ...normalizePermissions(claims?.permissions),
    ...normalizePermissions(request.userPermissions),
    ...getUserPermissionsFromHeaders(request),
  ];
  const uniquePermissions = [...new Set(permissions)];

  return {
    id,
    email,
    role,
    permissions: uniquePermissions,
    source: claims ? "jwt-claims" : "headers",
  };
}

export function ensurePermissionFormat(permission: string): Permission {
  const normalized = normalizePermission(permission);
  if (!normalized) {
    throw new BadRequestError("permission must use domain.resource.action format");
  }
  return normalized;
}

export async function verifyAuthToken(
  token: string,
  config: CognitoIntegrationConfig,
  verifier?: ((token: string, config: CognitoIntegrationConfig) => Promise<CognitoVerificationResult> | CognitoVerificationResult) | undefined,
): Promise<AuthJwtClaimsPlaceholder | undefined> {
  if (!token.trim()) return undefined;
  const result = verifier ? await verifier(token, config) : await verifyCognitoJwt(token, config);
  return result.verified ? normalizeAuthClaims(result.claims) : undefined;
}
