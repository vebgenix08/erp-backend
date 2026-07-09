"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAuthFromRequest = resolveAuthFromRequest;
exports.requireAuth = requireAuth;
exports.hasPermission = hasPermission;
exports.requirePermission = requirePermission;
const errors_1 = require("@school-erp/errors");
const helpers_1 = require("./helpers");
function createContext(partial) {
    return {
        user: partial.user,
        tenant: partial.tenant,
        requestId: partial.requestId,
        source: partial.source,
        authenticatedAt: partial.authenticatedAt,
    };
}
function resolveAuthFromRequest(request = {}, options = {}) {
    const claims = (0, helpers_1.normalizeAuthClaims)(request.jwtClaims ?? request.claims);
    const user = (0, helpers_1.buildAuthUser)(request, claims);
    const tenant = (0, helpers_1.buildTenantContext)(request);
    if (claims) {
        return createContext({
            user,
            tenant,
            requestId: request.requestId,
            source: "jwt-claims",
            authenticatedAt: new Date(),
        });
    }
    if (request.userId || request.userEmail || request.userRole || request.userPermissions || request.headers) {
        return createContext({
            user,
            tenant,
            requestId: request.requestId,
            source: "headers",
            authenticatedAt: new Date(),
        });
    }
    return createContext({
        user,
        tenant,
        requestId: request.requestId,
        source: options.defaultSource ?? "unknown",
        authenticatedAt: new Date(),
    });
}
function requireAuth(context) {
    if (!context?.user?.id) {
        throw new errors_1.UnauthorizedError("authentication is required");
    }
    return context;
}
function hasPermission(context, permission) {
    const user = context?.user;
    if (!user)
        return false;
    const normalized = permission.trim().toLowerCase();
    const permissions = user.permissions ?? [];
    return permissions.includes(normalized) || permissions.includes("*");
}
function requirePermission(context, permission) {
    requireAuth(context);
    if (!hasPermission(context, (0, helpers_1.ensurePermissionFormat)(permission))) {
        throw new errors_1.ForbiddenError(`missing permission: ${permission}`);
    }
    return context;
}
