import type {
  SessionAuthContext,
  SessionPayload,
  SessionRoleSnapshot,
  SessionScopeSnapshot,
  SessionTenantSnapshot,
  SessionUserSnapshot,
} from "./session.model";
import type { Permission } from "@school-erp/auth";

export interface ResolvedSessionAuthorization {
  role?: string | undefined;
  roles: SessionRoleSnapshot[];
  permissions: Permission[];
  scopes: SessionScopeSnapshot[];
}

export function toSessionUserSnapshot(
  context: SessionAuthContext,
  authorization?: ResolvedSessionAuthorization,
): SessionUserSnapshot {
  const user = context.user;
  if (!user) {
    throw new Error("auth context is required");
  }
  return {
    id: user.id,
    email: user.email,
    role: authorization?.role ?? user.role,
    roles:
      authorization?.roles ??
      (user.role ? [{ code: user.role, name: user.role.replaceAll("_", " ") }] : []),
    permissions: [...new Set(authorization?.permissions ?? user.permissions)],
    scopes: authorization?.scopes ?? [],
    source: user.source,
  };
}

export function toSessionTenantSnapshot(
  tenant: SessionAuthContext["tenant"] | null | undefined,
): SessionTenantSnapshot | null {
  if (!tenant?.tenantId) return null;
  return {
    tenantId: tenant.tenantId,
    tenantCode: tenant.tenantCode,
    source: tenant.source,
  };
}

export function toSessionPayload(
  context: SessionAuthContext,
  selectedTenant: SessionTenantSnapshot | null,
  authorization?: ResolvedSessionAuthorization,
): SessionPayload {
  return {
    user: toSessionUserSnapshot(context, authorization),
    tenant: toSessionTenantSnapshot(context.tenant),
    selectedTenant,
    authenticatedAt: context.authenticatedAt.toISOString(),
  };
}
