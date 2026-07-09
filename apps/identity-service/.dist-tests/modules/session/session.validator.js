"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSelectTenantInput = validateSelectTenantInput;
const errors_1 = require("@school-erp/errors");
function validateSelectTenantInput(input) {
    const value = input;
    if (!value || typeof value !== "object") {
        throw new errors_1.BadRequestError("select tenant input is required");
    }
    const tenantId = typeof value.tenantId === "string" ? value.tenantId.trim() : "";
    const tenantCode = typeof value.tenantCode === "string" ? value.tenantCode.trim() : "";
    if (!tenantId && !tenantCode) {
        throw new errors_1.BadRequestError("tenantId or tenantCode is required");
    }
    const result = {};
    if (tenantId)
        result.tenantId = tenantId;
    if (tenantCode)
        result.tenantCode = tenantCode;
    return result;
}
