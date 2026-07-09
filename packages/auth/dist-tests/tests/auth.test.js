"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const tenancy_1 = require("@school-erp/tenancy");
const index_1 = require("../index");
(0, node_test_1.default)("resolves auth from jwt claims first", () => {
    const context = (0, index_1.resolveAuthFromRequest)({
        jwtClaims: {
            sub: "user-1",
            email: "principal@example.com",
            role: "ADMIN",
            permissions: ["platform.tenant.create", "academics.student.read"],
            tenantId: "tenant-1",
        },
        headers: {
            "x-user-id": "user-header",
            "x-tenant-id": "tenant-header",
        },
    });
    strict_1.default.equal(context.source, "jwt-claims");
    strict_1.default.equal(context.user?.id, "user-1");
    strict_1.default.equal(context.user?.email, "principal@example.com");
    strict_1.default.equal(context.tenant?.tenantId, "tenant-1");
});
(0, node_test_1.default)("resolves auth from local headers", () => {
    const context = (0, index_1.resolveAuthFromRequest)({
        headers: {
            "x-user-id": "user-local",
            "x-user-email": "local@example.com",
            "x-user-role": "teacher",
            "x-user-permissions": "academics.student.create, finance.payment.collect",
            "x-tenant-id": "tenant-local",
        },
    });
    strict_1.default.equal(context.source, "headers");
    strict_1.default.equal(context.user?.id, "user-local");
    strict_1.default.equal(context.user?.email, "local@example.com");
    strict_1.default.equal(context.user?.role, "TEACHER");
    strict_1.default.equal(context.tenant?.tenantId, "tenant-local");
    strict_1.default.equal((0, index_1.hasPermission)(context, "academics.student.create"), true);
    strict_1.default.equal((0, index_1.hasPermission)(context, "finance.payment.collect"), true);
});
(0, node_test_1.default)("requireAuth rejects missing user", () => {
    strict_1.default.throws(() => (0, index_1.requireAuth)((0, index_1.resolveAuthFromRequest)()), /authentication is required/i);
});
(0, node_test_1.default)("requirePermission enforces permission checks", () => {
    const context = (0, index_1.resolveAuthFromRequest)({
        headers: {
            "x-user-id": "user-local",
            "x-user-permissions": "platform.tenant.create",
            "x-tenant-id": "tenant-local",
        },
    });
    strict_1.default.doesNotThrow(() => (0, index_1.requirePermission)(context, "platform.tenant.create"));
    strict_1.default.throws(() => (0, index_1.requirePermission)(context, "platform.tenant.delete"), /missing permission/i);
});
(0, node_test_1.default)("auth context can be combined with tenant context", () => {
    const context = (0, index_1.resolveAuthFromRequest)({
        headers: {
            "x-user-id": "user-local",
            "x-user-permissions": "platform.tenant.create",
            "x-tenant-id": "tenant-local",
        },
    });
    const tenantContext = (0, tenancy_1.createTenantContext)({ source: "request", tenantId: context.tenant?.tenantId, tenantCode: "TENANT-LOCAL" });
    strict_1.default.equal(tenantContext.tenantId, "tenant-local");
});
