import type { SessionAuthContext, SessionPayload, SessionTenantSnapshot, SessionUserSnapshot } from "./session.model";

export function toSessionUserSnapshot(context: SessionAuthContext): SessionUserSnapshot {
  const user = context.user;
  if (!user) {
    throw new Error("auth context is required");
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: [...user.permissions],
    source: user.source,
  };
}

export function toSessionTenantSnapshot(tenant: SessionAuthContext["tenant"] | null | undefined): SessionTenantSnapshot | null {
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
): SessionPayload {
  return {
    user: toSessionUserSnapshot(context),
    tenant: toSessionTenantSnapshot(context.tenant),
    selectedTenant,
    authenticatedAt: context.authenticatedAt.toISOString(),
  };
}
