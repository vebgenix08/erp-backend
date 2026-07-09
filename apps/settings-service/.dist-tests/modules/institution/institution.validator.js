"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInstitutionProfileInput = validateInstitutionProfileInput;
exports.validateInstitutionProfileUpdateInput = validateInstitutionProfileUpdateInput;
const errors_1 = require("@school-erp/errors");
const validation_1 = require("@school-erp/validation");
function normalizeOptional(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function validateInstitutionProfileInput(input) {
    if (!input || typeof input !== "object") {
        throw new errors_1.BadRequestError("institution profile payload is required");
    }
    const payload = input;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!(0, validation_1.isNonEmptyString)(name)) {
        throw new errors_1.BadRequestError("institution name is required");
    }
    const contactEmail = normalizeOptional(payload.contactEmail);
    if (contactEmail && !(0, validation_1.validateEmail)(contactEmail)) {
        throw new errors_1.BadRequestError("contact email is invalid");
    }
    const contactPhone = normalizeOptional(payload.contactPhone);
    if (contactPhone && !(0, validation_1.validatePhone)(contactPhone)) {
        throw new errors_1.BadRequestError("contact phone is invalid");
    }
    return {
        name,
        ...(normalizeOptional(payload.shortName) !== undefined ? { shortName: normalizeOptional(payload.shortName) } : {}),
        ...(contactEmail !== undefined ? { contactEmail } : {}),
        ...(contactPhone !== undefined ? { contactPhone } : {}),
        ...(normalizeOptional(payload.address) !== undefined ? { address: normalizeOptional(payload.address) } : {}),
        ...(normalizeOptional(payload.logoUrl) !== undefined ? { logoUrl: normalizeOptional(payload.logoUrl) } : {}),
    };
}
function validateInstitutionProfileUpdateInput(input) {
    if (!input || typeof input !== "object") {
        throw new errors_1.BadRequestError("institution profile payload is required");
    }
    const payload = input;
    const result = {};
    if (typeof payload.name === "string") {
        const name = payload.name.trim();
        if (!(0, validation_1.isNonEmptyString)(name)) {
            throw new errors_1.BadRequestError("institution name is required");
        }
        result.name = name;
    }
    const shortName = normalizeOptional(payload.shortName);
    if (shortName !== undefined)
        result.shortName = shortName;
    const contactEmail = normalizeOptional(payload.contactEmail);
    if (contactEmail !== undefined) {
        if (!(0, validation_1.validateEmail)(contactEmail)) {
            throw new errors_1.BadRequestError("contact email is invalid");
        }
        result.contactEmail = contactEmail;
    }
    const contactPhone = normalizeOptional(payload.contactPhone);
    if (contactPhone !== undefined) {
        if (!(0, validation_1.validatePhone)(contactPhone)) {
            throw new errors_1.BadRequestError("contact phone is invalid");
        }
        result.contactPhone = contactPhone;
    }
    const address = normalizeOptional(payload.address);
    if (address !== undefined)
        result.address = address;
    const logoUrl = normalizeOptional(payload.logoUrl);
    if (logoUrl !== undefined)
        result.logoUrl = logoUrl;
    return result;
}
