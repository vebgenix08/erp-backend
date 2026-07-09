"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonResponse = jsonResponse;
exports.errorResponse = errorResponse;
const errors_1 = require("@school-erp/errors");
function jsonResponse(statusCode, body, headers = {}) {
    return {
        statusCode,
        headers: {
            "content-type": "application/json; charset=utf-8",
            ...headers,
        },
        body,
    };
}
function errorResponse(error) {
    const mapped = (0, errors_1.mapErrorToResponse)(error);
    return jsonResponse(mapped.statusCode, mapped.body, {
        "x-error-code": mapped.body.error.code,
    });
}
