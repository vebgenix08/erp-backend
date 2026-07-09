"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenantContext = createTenantContext;
exports.resolveTenantFromRequest = resolveTenantFromRequest;
exports.requireTenant = requireTenant;
exports.requireTenantId = requireTenantId;
exports.requireTenantCode = requireTenantCode;
exports.hasTenantId = hasTenantId;
exports.hasTenantCode = hasTenantCode;
exports.getTenantResolutionSource = getTenantResolutionSource;
const errors_1 = require("@school-erp/errors");
const helpers_1 = require("./helpers");
function buildContext(partial) {
    return {
        tenantId: partial.tenantId,
        tenantCode: partial.tenantCode,
        tenantType: partial.tenantType,
        source: partial.source,
        requestId: partial.requestId,
        userId: partial.userId,
        hostname: partial.hostname,
        resolvedAt: partial.resolvedAt,
    };
}
function createTenantContext(input) {
    return buildContext({ ...input, resolvedAt: input.resolvedAt ?? new Date() });
}
function resolveTenantFromRequest(request = {}, options = {}) {
    const claims = (0, helpers_1.normalizeTenantClaims)(request.jwtClaims ?? request.claims);
    if (claims && (claims.tenantId || claims.tenantCode)) {
        return createTenantContext({
            tenantId: claims.tenantId,
            tenantCode: claims.tenantCode,
            tenantType: claims.tenantType,
            source: "jwt-claims",
            requestId: request.requestId,
            userId: request.userId,
            hostname: request.hostname ?? request.host,
        });
    }
    const tenantId = (0, helpers_1.getTenantIdFromHeaders)(request);
    if (tenantId) {
        return createTenantContext({
            tenantId,
            source: "x-tenant-id",
            requestId: request.requestId,
            userId: request.userId,
            hostname: request.hostname ?? request.host,
        });
    }
    const tenantCode = (0, helpers_1.getTenantCodeFromHeaders)(request);
    if (tenantCode) {
        return createTenantContext({
            tenantCode,
            source: "x-tenant-code",
            requestId: request.requestId,
            userId: request.userId,
            hostname: request.hostname ?? request.host,
        });
    }
    const subdomain = (0, helpers_1.getTenantSubdomain)(request);
    if (subdomain) {
        return createTenantContext({
            tenantCode: subdomain,
            source: "subdomain",
            requestId: request.requestId,
            userId: request.userId,
            hostname: request.hostname ?? request.host,
        });
    }
    return createTenantContext({
        source: options.defaultSource ?? "unknown",
        requestId: request.requestId,
        userId: request.userId,
        hostname: request.hostname ?? request.host,
    });
}
function requireTenant(context) {
    if (!context || !context.tenantId) {
        throw new errors_1.BadRequestError("tenant context is required");
    }
    return context;
}
function requireTenantId(context) {
    return requireTenant(context).tenantId;
}
function requireTenantCode(context) {
    const value = context?.tenantCode?.trim();
    if (!value) {
        throw new errors_1.BadRequestError("tenant code is required");
    }
    return value;
}
function hasTenantId(context) {
    return Boolean(context?.tenantId?.trim());
}
function hasTenantCode(context) {
    return Boolean(context?.tenantCode?.trim());
}
function getTenantResolutionSource(context) {
    return context?.source ?? "unknown";
}
