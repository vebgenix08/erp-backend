"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTenantId = normalizeTenantId;
exports.normalizeTenantCode = normalizeTenantCode;
exports.normalizeTenantClaims = normalizeTenantClaims;
exports.getTenantIdFromHeaders = getTenantIdFromHeaders;
exports.getTenantCodeFromHeaders = getTenantCodeFromHeaders;
exports.getTenantSubdomain = getTenantSubdomain;
exports.hasTenantHeaders = hasTenantHeaders;
const TENANT_ID_HEADERS = ["x-tenant-id", "tenant-id"];
const TENANT_CODE_HEADERS = ["x-tenant-code", "tenant-code"];
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
function normalizeTenantId(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function normalizeTenantCode(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim().toUpperCase();
    return trimmed.length > 0 ? trimmed : undefined;
}
function normalizeTenantClaims(value) {
    if (!value)
        return undefined;
    return {
        tenantId: normalizeTenantId(value.tenantId),
        tenantCode: normalizeTenantCode(value.tenantCode),
        tenantType: value.tenantType,
    };
}
function getTenantIdFromHeaders(request) {
    return normalizeTenantId(readHeader(request.headers, TENANT_ID_HEADERS));
}
function getTenantCodeFromHeaders(request) {
    return normalizeTenantCode(readHeader(request.headers, TENANT_CODE_HEADERS));
}
function getTenantSubdomain(request) {
    if (typeof request.subdomain === "string" && request.subdomain.trim().length > 0) {
        return request.subdomain.trim().toLowerCase();
    }
    const hostname = request.hostname ?? request.host;
    if (!hostname)
        return undefined;
    const cleaned = hostname.trim().toLowerCase();
    if (!cleaned || cleaned === "localhost" || cleaned === "127.0.0.1")
        return undefined;
    const [subdomain] = cleaned.split(".");
    if (!subdomain || subdomain === "www")
        return undefined;
    return subdomain;
}
function hasTenantHeaders(request) {
    return Boolean(getTenantIdFromHeaders(request) || getTenantCodeFromHeaders(request));
}
