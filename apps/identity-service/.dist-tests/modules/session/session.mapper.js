"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSessionUserSnapshot = toSessionUserSnapshot;
exports.toSessionTenantSnapshot = toSessionTenantSnapshot;
exports.toSessionPayload = toSessionPayload;
function toSessionUserSnapshot(context) {
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
function toSessionTenantSnapshot(tenant) {
    if (!tenant?.tenantId)
        return null;
    return {
        tenantId: tenant.tenantId,
        tenantCode: tenant.tenantCode,
        source: tenant.source,
    };
}
function toSessionPayload(context, selectedTenant) {
    return {
        user: toSessionUserSnapshot(context),
        tenant: toSessionTenantSnapshot(context.tenant),
        selectedTenant,
        authenticatedAt: context.authenticatedAt.toISOString(),
    };
}
