"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.tenantMiddleware = tenantMiddleware;
exports.validationMiddleware = validationMiddleware;
exports.bodyRequiredMiddleware = bodyRequiredMiddleware;
const auth_1 = require("@school-erp/auth");
const tenancy_1 = require("@school-erp/tenancy");
const errors_1 = require("@school-erp/errors");
const request_1 = require("./request");
function authMiddleware() {
    return async (context, next) => {
        const authContext = (0, auth_1.resolveAuthFromRequest)({
            requestId: context.requestId,
            headers: context.headers,
            tenantId: context.tenantContext?.tenantId,
        });
        context.authContext = (0, auth_1.requireAuth)(authContext);
        return next();
    };
}
function tenantMiddleware() {
    return async (context, next) => {
        const tenantContext = (0, tenancy_1.resolveTenantFromRequest)({
            requestId: context.requestId,
            headers: context.headers,
            tenantId: context.tenantContext?.tenantId,
            hostname: (0, request_1.getHeaderValue)(context.headers, "host"),
        });
        context.tenantContext = (0, tenancy_1.requireTenant)(tenantContext.tenantId ? tenantContext : undefined);
        return next();
    };
}
function validationMiddleware(validator) {
    return async (context, next) => {
        await validator(context);
        return next();
    };
}
function bodyRequiredMiddleware() {
    return async (context, next) => {
        if (context.body === undefined || context.body === null) {
            throw new errors_1.BadRequestError("request body is required");
        }
        return next();
    };
}
