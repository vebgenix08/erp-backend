import type { Permission } from "@school-erp/auth";
import type { TenantContext, TenantResolutionSource } from "@school-erp/tenancy";

export interface SessionUserSnapshot {
  id: string;
  email?: string | undefined;
  role?: string | undefined;
  permissions: Permission[];
  source: "jwt-claims" | "headers" | "request" | "unknown";
}

export interface SessionTenantSnapshot {
  tenantId: string;
  tenantCode?: string | undefined;
  source: TenantResolutionSource;
}

export interface SessionPayload {
  user: SessionUserSnapshot;
  tenant: SessionTenantSnapshot | null;
  selectedTenant: SessionTenantSnapshot | null;
  authenticatedAt: string;
}

export interface SelectTenantInput {
  tenantId?: string | undefined;
  tenantCode?: string | undefined;
}

export interface SessionContextShape {
  userId: string;
  tenantId?: string | undefined;
}

export interface SessionRepositoryRecord {
  userId: string;
  selectedTenant: SessionTenantSnapshot;
  updatedAt: Date;
}

export interface SessionRepository {
  getSelectedTenant(userId: string): Promise<SessionTenantSnapshot | null>;
  saveSelectedTenant(userId: string, tenant: SessionTenantSnapshot): Promise<SessionTenantSnapshot>;
}

export type SessionAuthContext = {
  user?: {
    id: string;
    email?: string | undefined;
    role?: string | undefined;
    permissions: Permission[];
    source: "jwt-claims" | "headers" | "request" | "unknown";
  } | undefined;
  tenant?: TenantContext | undefined;
  authenticatedAt: Date;
};
