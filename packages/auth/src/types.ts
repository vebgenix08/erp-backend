import type { TenantContext } from "@school-erp/tenancy";

export type Permission = `${string}.${string}.${string}`;

export interface AuthUser {
  id: string;
  email?: string | undefined;
  role?: string | undefined;
  permissions: Permission[];
  source: AuthResolutionSource;
}

export type AuthResolutionSource = "jwt-claims" | "headers" | "request" | "unknown";

export interface AuthContext {
  user?: AuthUser | undefined;
  tenant?: TenantContext | undefined;
  requestId?: string | undefined;
  source: AuthResolutionSource;
  authenticatedAt: Date;
}

export interface AuthJwtClaimsPlaceholder {
  sub?: string | undefined;
  email?: string | undefined;
  role?: string | undefined;
  permissions?: string[] | string | undefined;
  tenantId?: string | undefined;
  tenantCode?: string | undefined;
}

export interface AuthRequestLike {
  headers?: Record<string, string | string[] | undefined> | undefined;
  requestId?: string | undefined;
  jwtClaims?: AuthJwtClaimsPlaceholder | undefined;
  claims?: AuthJwtClaimsPlaceholder | undefined;
  userId?: string | undefined;
  userEmail?: string | undefined;
  userRole?: string | undefined;
  userPermissions?: string | string[] | undefined;
  tenantId?: string | undefined;
}

export interface AuthContextOptions {
  defaultSource?: AuthResolutionSource | undefined;
}
