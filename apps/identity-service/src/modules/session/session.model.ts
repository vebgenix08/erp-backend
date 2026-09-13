import type { Permission } from "@school-erp/auth";
import type { TenantContext, TenantResolutionSource } from "@school-erp/tenancy";
import type { AccessScope } from "../access/access.model";

export interface SessionRoleSnapshot {
  id?: string | undefined;
  code: string;
  name: string;
}

export interface SessionScopeSnapshot {
  assignmentId: string;
  roleId: string;
  roleCode: string;
  scope: AccessScope;
}

export interface SessionUserSnapshot {
  id: string;
  email?: string | undefined;
  fullName?: string | undefined;
  profilePhotoFileId?: string | undefined;
  role?: string | undefined;
  roles: SessionRoleSnapshot[];
  permissions: Permission[];
  scopes: SessionScopeSnapshot[];
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
  expiresAt: Date;
}

export interface SessionRepository {
  getSelectedTenant(userId: string): Promise<SessionTenantSnapshot | null>;
  saveSelectedTenant(userId: string, tenant: SessionTenantSnapshot): Promise<SessionTenantSnapshot>;
  deleteSelectedTenant(userId: string): Promise<void>;
}

export type SessionAuthContext = {
  user?:
    | {
        id: string;
        email?: string | undefined;
        role?: string | undefined;
        permissions: Permission[];
        source: "jwt-claims" | "headers" | "request" | "unknown";
      }
    | undefined;
  tenant?: TenantContext | undefined;
  authenticatedAt: Date;
};
