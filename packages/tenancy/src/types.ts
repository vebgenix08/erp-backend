import type { TenantType } from "@school-erp/types";

export interface TenantClaimsPlaceholder {
  tenantId?: string | undefined;
  tenantCode?: string | undefined;
  tenantType?: TenantType | undefined;
}

export interface TenantRequestLike {
  headers?: Record<string, string | string[] | undefined> | undefined;
  hostname?: string | undefined;
  host?: string | undefined;
  subdomain?: string | undefined;
  jwtClaims?: TenantClaimsPlaceholder | undefined;
  claims?: TenantClaimsPlaceholder | undefined;
  requestId?: string | undefined;
  userId?: string | undefined;
  tenantId?: string | undefined;
  tenantCode?: string | undefined;
}

export type TenantResolutionSource =
  | "jwt-claims"
  | "x-tenant-id"
  | "x-tenant-code"
  | "subdomain"
  | "request"
  | "unknown";

export interface TenantContext {
  tenantId?: string | undefined;
  tenantCode?: string | undefined;
  tenantType?: TenantType | undefined;
  source: TenantResolutionSource;
  requestId?: string | undefined;
  userId?: string | undefined;
  hostname?: string | undefined;
  resolvedAt: Date;
}

export interface TenantContextOptions {
  defaultSource?: TenantResolutionSource | undefined;
}
