"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantPermissions = void 0;
exports.tenantPermissions = {
    list: { action: "READ", resource: "platform.tenants" },
    get: { action: "READ", resource: "platform.tenants" },
    create: { action: "CREATE", resource: "platform.tenants" },
    update: { action: "UPDATE", resource: "platform.tenants" },
    deactivate: { action: "UPDATE", resource: "platform.tenants" },
};
