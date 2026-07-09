"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeaderValue = getHeaderValue;
exports.parseJsonBody = parseJsonBody;
exports.createRequestContext = createRequestContext;
const errors_1 = require("@school-erp/errors");
function normalizeMethod(method, defaultMethod = "GET") {
    const normalized = (method ?? defaultMethod).toUpperCase();
    if (normalized === "GET" ||
        normalized === "POST" ||
        normalized === "PUT" ||
        normalized === "PATCH" ||
        normalized === "DELETE" ||
        normalized === "OPTIONS" ||
        normalized === "HEAD") {
        return normalized;
    }
    throw new errors_1.BadRequestError(`unsupported method: ${method}`);
}
function getHeaderValue(headers, name) {
    const value = headers?.[name] ?? headers?.[name.toLowerCase()];
    if (Array.isArray(value)) {
        return value[0]?.trim() || undefined;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
}
function normalizeHeaders(headers) {
    return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
}
function normalizeQuery(query) {
    return { ...(query ?? {}) };
}
function parseJsonBody(body) {
    if (body === undefined || body.trim().length === 0) {
        return undefined;
    }
    try {
        return JSON.parse(body);
    }
    catch {
        throw new errors_1.BadRequestError("request body must be valid JSON");
    }
}
function createRequestContext(request, options = {}) {
    const method = normalizeMethod(request.method, options.defaultMethod);
    return {
        requestId: request.requestId ?? options.requestId ?? `req_${Date.now()}`,
        tenantContext: request.tenantContext,
        authContext: request.authContext,
        path: request.path,
        method,
        headers: normalizeHeaders(request.headers),
        query: normalizeQuery(request.query),
        body: request.body ?? parseJsonBody(request.rawBody),
        params: {},
    };
}
