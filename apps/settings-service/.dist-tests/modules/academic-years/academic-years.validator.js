"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAcademicYearCreateInput = validateAcademicYearCreateInput;
exports.validateAcademicYearUpdateInput = validateAcademicYearUpdateInput;
exports.validateAcademicYearListFilter = validateAcademicYearListFilter;
const errors_1 = require("@school-erp/errors");
const validation_1 = require("@school-erp/validation");
const STATUS = ["ACTIVE", "INACTIVE"];
function normalizeOptional(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function normalizeDate(value, label) {
    const raw = normalizeOptional(value);
    if (!raw)
        throw new errors_1.BadRequestError(`${label} is required`);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        throw new errors_1.BadRequestError(`${label} is invalid`);
    }
    return parsed.toISOString().slice(0, 10);
}
function validateAcademicYearCreateInput(input) {
    if (!input || typeof input !== "object") {
        throw new errors_1.BadRequestError("academic year payload is required");
    }
    const payload = input;
    const code = normalizeOptional(payload.code);
    const name = normalizeOptional(payload.name);
    if (!(0, validation_1.isNonEmptyString)(code ?? ""))
        throw new errors_1.BadRequestError("academic year code is required");
    if (!(0, validation_1.isNonEmptyString)(name ?? ""))
        throw new errors_1.BadRequestError("academic year name is required");
    const startDate = normalizeDate(payload.startDate, "start date");
    const endDate = normalizeDate(payload.endDate, "end date");
    if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
        throw new errors_1.BadRequestError("end date must be after start date");
    }
    return { code: code, name: name, startDate, endDate };
}
function validateAcademicYearUpdateInput(input) {
    if (!input || typeof input !== "object") {
        throw new errors_1.BadRequestError("academic year payload is required");
    }
    const payload = input;
    const result = {};
    const code = normalizeOptional(payload.code);
    const name = normalizeOptional(payload.name);
    if (code !== undefined)
        result.code = code;
    if (name !== undefined)
        result.name = name;
    if (payload.startDate !== undefined)
        result.startDate = normalizeDate(payload.startDate, "start date");
    if (payload.endDate !== undefined)
        result.endDate = normalizeDate(payload.endDate, "end date");
    if (result.startDate && result.endDate && new Date(result.startDate).getTime() >= new Date(result.endDate).getTime()) {
        throw new errors_1.BadRequestError("end date must be after start date");
    }
    return result;
}
function validateAcademicYearListFilter(input) {
    if (!input || typeof input !== "object")
        return {};
    const payload = input;
    const status = normalizeOptional(payload.status);
    if (status !== undefined && !STATUS.includes(status)) {
        throw new errors_1.BadRequestError("academic year status is invalid");
    }
    return status !== undefined ? { status } : {};
}
