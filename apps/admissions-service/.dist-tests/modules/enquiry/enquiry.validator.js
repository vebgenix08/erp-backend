"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnquiryCreateInput = validateEnquiryCreateInput;
exports.validateEnquiryUpdateInput = validateEnquiryUpdateInput;
exports.validateEnquiryListFilter = validateEnquiryListFilter;
const errors_1 = require("@school-erp/errors");
const validation_1 = require("@school-erp/validation");
const ALLOWED_GENDERS = ["MALE", "FEMALE", "OTHER"];
const ALLOWED_STATUS_UPDATES = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED"];
const ALLOWED_STATUS_FILTERS = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "CLOSED"];
function normalizeObject(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new errors_1.ValidationError([{ field: "body", message: "request body must be an object" }]);
    }
    return input;
}
function parseDate(value, field) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new errors_1.ValidationError([{ field, message: "must be a valid date" }]);
        }
        return value;
    }
    if (typeof value !== "string") {
        throw new errors_1.ValidationError([{ field, message: "must be a valid date" }]);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new errors_1.ValidationError([{ field, message: "must be a valid date" }]);
    }
    return date;
}
function parseGender(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new errors_1.ValidationError([{ field: "gender", message: "must be MALE, FEMALE or OTHER" }]);
    }
    const normalized = value.trim().toUpperCase();
    if (!ALLOWED_GENDERS.includes(normalized)) {
        throw new errors_1.ValidationError([{ field: "gender", message: "must be MALE, FEMALE or OTHER" }]);
    }
    return normalized;
}
function parseOptionalString(value) {
    return (0, validation_1.optionalString)(value);
}
function validateEnquiryCreateInput(input) {
    const body = normalizeObject(input);
    const errors = [];
    const studentName = (0, validation_1.validateNonEmptyString)(body.studentName, "studentName");
    const parentName = (0, validation_1.validateNonEmptyString)(body.parentName, "parentName");
    const phone = (0, validation_1.validatePhone)(body.phone, "phone");
    const email = body.email === undefined ? undefined : (0, validation_1.validateEmail)(body.email, "email");
    if (!studentName.success)
        errors.push({ field: "studentName", message: studentName.errors[0] ?? "studentName is required" });
    if (!parentName.success)
        errors.push({ field: "parentName", message: parentName.errors[0] ?? "parentName is required" });
    if (!phone.success)
        errors.push({ field: "phone", message: phone.errors[0] ?? "phone is required" });
    if (email !== undefined && !email.success)
        errors.push({ field: "email", message: email.errors[0] ?? "email is invalid" });
    if (errors.length > 0) {
        throw new errors_1.ValidationError(errors);
    }
    const validatedStudentName = studentName.success ? studentName.value : "";
    const validatedParentName = parentName.success ? parentName.value : "";
    const validatedPhone = phone.success ? phone.value : "";
    const validatedEmail = email?.success ? email.value : undefined;
    return {
        studentName: validatedStudentName,
        dateOfBirth: parseDate(body.dateOfBirth, "dateOfBirth"),
        gender: parseGender(body.gender),
        parentName: validatedParentName,
        phone: validatedPhone,
        email: validatedEmail,
        interestedClass: parseOptionalString(body.interestedClass),
        source: parseOptionalString(body.source),
        notes: parseOptionalString(body.notes),
    };
}
function validateEnquiryUpdateInput(input) {
    const body = normalizeObject(input);
    const update = {};
    const errors = [];
    if (body.studentName !== undefined) {
        const value = (0, validation_1.validateNonEmptyString)(body.studentName, "studentName");
        if (!value.success)
            errors.push({ field: "studentName", message: value.errors[0] ?? "studentName cannot be empty" });
        else
            update.studentName = value.value;
    }
    if (body.parentName !== undefined) {
        const value = (0, validation_1.validateNonEmptyString)(body.parentName, "parentName");
        if (!value.success)
            errors.push({ field: "parentName", message: value.errors[0] ?? "parentName cannot be empty" });
        else
            update.parentName = value.value;
    }
    if (body.phone !== undefined) {
        const value = (0, validation_1.validatePhone)(body.phone, "phone");
        if (!value.success)
            errors.push({ field: "phone", message: value.errors[0] ?? "phone is invalid" });
        else
            update.phone = value.value;
    }
    if (body.email !== undefined) {
        if (body.email === null || body.email === "") {
            update.email = undefined;
        }
        else {
            const value = (0, validation_1.validateEmail)(body.email, "email");
            if (!value.success)
                errors.push({ field: "email", message: value.errors[0] ?? "email is invalid" });
            else
                update.email = value.value;
        }
    }
    if (body.dateOfBirth !== undefined) {
        update.dateOfBirth = parseDate(body.dateOfBirth, "dateOfBirth");
    }
    if (body.gender !== undefined) {
        try {
            update.gender = parseGender(body.gender);
        }
        catch (error) {
            errors.push({ field: "gender", message: error instanceof Error ? error.message : "gender is invalid" });
        }
    }
    if (body.interestedClass !== undefined) {
        update.interestedClass = parseOptionalString(body.interestedClass);
    }
    if (body.source !== undefined) {
        update.source = parseOptionalString(body.source);
    }
    if (body.notes !== undefined) {
        update.notes = parseOptionalString(body.notes);
    }
    if (body.status !== undefined) {
        if (typeof body.status !== "string") {
            errors.push({ field: "status", message: "status must be a string" });
        }
        else {
            const normalized = body.status.trim().toUpperCase();
            if (!ALLOWED_STATUS_UPDATES.includes(normalized)) {
                errors.push({ field: "status", message: "status must be NEW, CONTACTED, FOLLOW_UP or CONVERTED" });
            }
            else {
                update.status = normalized;
            }
        }
    }
    if (errors.length > 0) {
        throw new errors_1.ValidationError(errors);
    }
    return update;
}
function validateEnquiryListFilter(input) {
    if (input === undefined || input === null || input === "") {
        return {};
    }
    if (typeof input !== "object" || Array.isArray(input)) {
        throw new errors_1.ValidationError([{ field: "filter", message: "filter must be an object" }]);
    }
    const body = input;
    const filter = {};
    const errors = [];
    if (body.status !== undefined) {
        if (typeof body.status !== "string") {
            errors.push({ field: "status", message: "status must be a string" });
        }
        else {
            const normalized = body.status.trim().toUpperCase();
            if (!ALLOWED_STATUS_FILTERS.includes(normalized)) {
                errors.push({ field: "status", message: "status must be NEW, CONTACTED, FOLLOW_UP, CONVERTED or CLOSED" });
            }
            else {
                filter.status = normalized;
            }
        }
    }
    if (body.source !== undefined) {
        const value = (0, validation_1.optionalString)(body.source);
        if (value !== undefined) {
            filter.source = value;
        }
    }
    if (body.search !== undefined) {
        const value = (0, validation_1.optionalString)(body.search);
        if (value !== undefined) {
            filter.search = value;
        }
    }
    if (errors.length > 0) {
        throw new errors_1.ValidationError(errors);
    }
    return filter;
}
