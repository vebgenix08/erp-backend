"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCampusCreateInput = validateCampusCreateInput;
exports.validateCampusUpdateInput = validateCampusUpdateInput;
exports.validateCampusListFilter = validateCampusListFilter;
const errors_1 = require("@school-erp/errors");
const validation_1 = require("@school-erp/validation");
const CAMPUS_TYPES = ["SCHOOL", "COLLEGE", "DEGREE_COLLEGE"];
const CAMPUS_STATUS = ["ACTIVE", "INACTIVE"];
function normalizeOptional(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function validateCampusCreateInput(input) {
    if (!input || typeof input !== "object") {
        throw new errors_1.BadRequestError("campus payload is required");
    }
    const payload = input;
    const code = normalizeOptional(payload.code);
    const name = normalizeOptional(payload.name);
    const campusType = normalizeOptional(payload.campusType);
    if (!(0, validation_1.isNonEmptyString)(code ?? ""))
        throw new errors_1.BadRequestError("campus code is required");
    if (!(0, validation_1.isNonEmptyString)(name ?? ""))
        throw new errors_1.BadRequestError("campus name is required");
    if (!campusType || !CAMPUS_TYPES.includes(campusType)) {
        throw new errors_1.BadRequestError("campus type is required");
    }
    return {
        code: code,
        name: name,
        campusType,
        ...(normalizeOptional(payload.address) !== undefined ? { address: normalizeOptional(payload.address) } : {}),
    };
}
function validateCampusUpdateInput(input) {
    if (!input || typeof input !== "object") {
        throw new errors_1.BadRequestError("campus payload is required");
    }
    const payload = input;
    const result = {};
    const code = normalizeOptional(payload.code);
    const name = normalizeOptional(payload.name);
    const campusType = normalizeOptional(payload.campusType);
    const status = normalizeOptional(payload.status);
    if (code !== undefined)
        result.code = code;
    if (name !== undefined)
        result.name = name;
    if (campusType !== undefined) {
        if (!CAMPUS_TYPES.includes(campusType))
            throw new errors_1.BadRequestError("campus type is required");
        result.campusType = campusType;
    }
    if (status !== undefined) {
        if (!CAMPUS_STATUS.includes(status))
            throw new errors_1.BadRequestError("campus status is invalid");
        result.status = status;
    }
    const address = normalizeOptional(payload.address);
    if (address !== undefined)
        result.address = address;
    return result;
}
function validateCampusListFilter(input) {
    if (!input || typeof input !== "object")
        return {};
    const payload = input;
    const status = normalizeOptional(payload.status);
    if (status !== undefined && !CAMPUS_STATUS.includes(status)) {
        throw new errors_1.BadRequestError("campus status is invalid");
    }
    return status !== undefined ? { status } : {};
}
