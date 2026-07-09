"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)("resolves tenant from jwt claims first", () => {
    const context = (0, index_1.resolveTenantFromRequest)({
        jwtClaims: { tenantId: "tenant-jwt", tenantCode: "JWT-001" },
        headers: {
            "x-tenant-id": "tenant-header",
            "x-tenant-code": "header-code",
        },
        hostname: "school.example.com",
    });
    strict_1.default.equal(context.source, "jwt-claims");
    strict_1.default.equal(context.tenantId, "tenant-jwt");
    strict_1.default.equal(context.tenantCode, "JWT-001");
});
(0, node_test_1.default)("falls back to x-tenant-id header", () => {
    const context = (0, index_1.resolveTenantFromRequest)({
        headers: { "x-tenant-id": "tenant-header" },
    });
    strict_1.default.equal(context.source, "x-tenant-id");
    strict_1.default.equal(context.tenantId, "tenant-header");
});
(0, node_test_1.default)("falls back to x-tenant-code header", () => {
    const context = (0, index_1.resolveTenantFromRequest)({
        headers: { "x-tenant-code": "code-123" },
    });
    strict_1.default.equal(context.source, "x-tenant-code");
    strict_1.default.equal(context.tenantCode, "CODE-123");
});
(0, node_test_1.default)("falls back to subdomain placeholder", () => {
    const context = (0, index_1.resolveTenantFromRequest)({
        hostname: "alpha.school.example.com",
    });
    strict_1.default.equal(context.source, "subdomain");
    strict_1.default.equal(context.tenantCode, "alpha");
});
(0, node_test_1.default)("requireTenant and helpers validate presence", () => {
    const context = (0, index_1.createTenantContext)({ source: "request", tenantId: "tenant-1", tenantCode: "T-1" });
    strict_1.default.equal((0, index_1.requireTenant)(context).tenantId, "tenant-1");
    strict_1.default.equal((0, index_1.requireTenantId)(context), "tenant-1");
    strict_1.default.equal((0, index_1.requireTenantCode)(context), "T-1");
    strict_1.default.equal((0, index_1.hasTenantId)(context), true);
    strict_1.default.equal((0, index_1.hasTenantCode)(context), true);
});
(0, node_test_1.default)("header helper readers normalize values", () => {
    strict_1.default.equal((0, index_1.getTenantIdFromHeaders)({ headers: { "x-tenant-id": "  tenant-a  " } }), "tenant-a");
    strict_1.default.equal((0, index_1.getTenantCodeFromHeaders)({ headers: { "x-tenant-code": " school-1 " } }), "SCHOOL-1");
    strict_1.default.equal((0, index_1.getTenantSubdomain)({ hostname: "tenant.example.com" }), "tenant");
});
(0, node_test_1.default)("requireTenant rejects missing tenantId", () => {
    strict_1.default.throws(() => (0, index_1.requireTenant)((0, index_1.createTenantContext)({ source: "unknown" })), /tenant context is required/i);
});
