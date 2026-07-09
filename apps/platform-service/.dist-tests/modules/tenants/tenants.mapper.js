"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTenantView = toTenantView;
function toTenantView(tenant) {
    if (!tenant)
        return null;
    return {
        ...tenant,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        deactivatedAt: tenant.deactivatedAt?.toISOString(),
    };
}
