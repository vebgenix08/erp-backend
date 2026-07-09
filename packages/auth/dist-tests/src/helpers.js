"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePermission = normalizePermission;
exports.normalizePermissions = normalizePermissions;
exports.normalizeAuthClaims = normalizeAuthClaims;
exports.getUserIdFromHeaders = getUserIdFromHeaders;
exports.getUserEmailFromHeaders = getUserEmailFromHeaders;
exports.getUserRoleFromHeaders = getUserRoleFromHeaders;
exports.getUserPermissionsFromHeaders = getUserPermissionsFromHeaders;
exports.buildTenantContext = buildTenantContext;
exports.buildAuthUser = buildAuthUser;
exports.ensurePermissionFormat = ensurePermissionFormat;
const errors_1 = require("@school-erp/errors");
const tenancy_1 = require("@school-erp/tenancy");
const USER_ID_HEADERS = ["x-user-id"];
const USER_EMAIL_HEADERS = ["x-user-email"];
const USER_ROLE_HEADERS = ["x-user-role"];
const USER_PERMISSIONS_HEADERS = ["x-user-permissions"];
function readHeader(headers, candidates) {
    if (!headers)
        return undefined;
    for (const candidate of candidates) {
        const value = headers[candidate] ?? headers[candidate.toLowerCase()];
        if (Array.isArray(value)) {
            const first = value[0]?.trim();
            if (first)
                return first;
            continue;
        }
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }
    return undefined;
}
function normalizePermission(value) {
    if (typeof value !== "string")
        return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized)
        return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+){2}$/.test(normalized))
        return null;
    return normalized;
}
function normalizePermissions(value) {
    if (Array.isArray(value)) {
        return value.flatMap((entry) => {
            const normalized = normalizePermission(entry);
            return normalized ? [normalized] : [];
        });
    }
    if (typeof value === "string") {
        return value
            .split(/[,\s]+/g)
            .map((entry) => normalizePermission(entry))
            .filter((entry) => Boolean(entry));
    }
    return [];
}
function normalizeAuthClaims(value) {
    if (!value)
        return undefined;
    return {
        sub: typeof value.sub === "string" ? value.sub.trim() || undefined : undefined,
        email: typeof value.email === "string" ? value.email.trim() || undefined : undefined,
        role: typeof value.role === "string" ? value.role.trim() || undefined : undefined,
        permissions: Array.isArray(value.permissions) ? value.permissions : typeof value.permissions === "string" ? value.permissions.split(/[,\s]+/g) : undefined,
        tenantId: typeof value.tenantId === "string" ? value.tenantId.trim() || undefined : undefined,
        tenantCode: typeof value.tenantCode === "string" ? value.tenantCode.trim() || undefined : undefined,
    };
}
function getUserIdFromHeaders(request) {
    return readHeader(request.headers, USER_ID_HEADERS);
}
function getUserEmailFromHeaders(request) {
    return readHeader(request.headers, USER_EMAIL_HEADERS)?.toLowerCase();
}
function getUserRoleFromHeaders(request) {
    return readHeader(request.headers, USER_ROLE_HEADERS)?.toUpperCase();
}
function getUserPermissionsFromHeaders(request) {
    return normalizePermissions(readHeader(request.headers, USER_PERMISSIONS_HEADERS));
}
function buildTenantContext(request) {
    if (request.tenantId || request.headers?.["x-tenant-id"]) {
        const tenantRequest = {
            ...request,
            headers: request.headers,
        };
        return (0, tenancy_1.resolveTenantFromRequest)(tenantRequest);
    }
    const claims = normalizeAuthClaims(request.jwtClaims ?? request.claims);
    if (claims?.tenantId || claims?.tenantCode) {
        return (0, tenancy_1.createTenantContext)({
            source: "jwt-claims",
            tenantId: claims.tenantId,
            tenantCode: claims.tenantCode,
        });
    }
    return undefined;
}
function buildAuthUser(request, claims) {
    const id = claims?.sub ?? getUserIdFromHeaders(request) ?? request.userId;
    if (!id) {
        return undefined;
    }
    const email = claims?.email ?? getUserEmailFromHeaders(request) ?? request.userEmail;
    const role = claims?.role ?? getUserRoleFromHeaders(request) ?? request.userRole;
    const permissions = [
        ...normalizePermissions(claims?.permissions),
        ...normalizePermissions(request.userPermissions),
        ...getUserPermissionsFromHeaders(request),
    ];
    const uniquePermissions = [...new Set(permissions)];
    return {
        id,
        email,
        role,
        permissions: uniquePermissions,
        source: claims ? "jwt-claims" : "headers",
    };
}
function ensurePermissionFormat(permission) {
    const normalized = normalizePermission(permission);
    if (!normalized) {
        throw new errors_1.BadRequestError("permission must use domain.resource.action format");
    }
    return normalized;
}
