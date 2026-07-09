"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTenantCreateInput = validateTenantCreateInput;
exports.validateTenantUpdateInput = validateTenantUpdateInput;
const errors_1 = require("@school-erp/errors");
const validation_1 = require("@school-erp/validation");
function isTenantType(value) {
    return value === "SCHOOL" || value === "COLLEGE" || value === "DEGREE_COLLEGE";
}
function isTenantStatus(value) {
    return value === "ACTIVE" || value === "INACTIVE" || value === "SUSPENDED";
}
function validateMonth(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const month = Number(value);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new errors_1.ValidationError([{ field: "academicYearStartMonth", message: "must be an integer between 1 and 12" }]);
    }
    return month;
}
function validateTenantCreateInput(input) {
    const name = (0, validation_1.validateNonEmptyString)(input.name, "name");
    const code = (0, validation_1.validateNonEmptyString)(input.code, "code");
    const contactEmail = input.contactEmail === undefined ? undefined : (0, validation_1.validateEmail)(input.contactEmail, "contactEmail");
    const contactPhone = input.contactPhone === undefined ? undefined : (0, validation_1.validatePhone)(input.contactPhone, "contactPhone");
    const address = (0, validation_1.optionalString)(input.address);
    const type = input.type;
    const errors = [];
    if (!name.success)
        errors.push({ field: "name", message: name.errors[0] ?? "name is required" });
    if (!code.success)
        errors.push({ field: "code", message: code.errors[0] ?? "code is required" });
    if (!isTenantType(type))
        errors.push({ field: "type", message: "type is required" });
    if (contactEmail !== undefined && !contactEmail.success)
        errors.push({ field: "contactEmail", message: contactEmail.errors[0] ?? "contactEmail is invalid" });
    if (contactPhone !== undefined && !contactPhone.success)
        errors.push({ field: "contactPhone", message: contactPhone.errors[0] ?? "contactPhone is invalid" });
    if (errors.length > 0) {
        throw new errors_1.ValidationError(errors);
    }
    const validatedName = name.success ? name.value : "";
    const validatedCode = code.success ? code.value : "";
    const validatedType = type;
    return {
        name: validatedName,
        code: validatedCode,
        type: validatedType,
        contactEmail: contactEmail?.success ? contactEmail.value : undefined,
        contactPhone: contactPhone?.success ? contactPhone.value : undefined,
        address,
        academicYearStartMonth: validateMonth(input.academicYearStartMonth),
    };
}
function validateTenantUpdateInput(input) {
    const update = {};
    const errors = [];
    if (input.name !== undefined) {
        const value = (0, validation_1.validateNonEmptyString)(input.name, "name");
        if (!value.success)
            errors.push({ field: "name", message: value.errors[0] ?? "name cannot be empty" });
        else
            update.name = value.value;
    }
    if (input.code !== undefined) {
        const value = (0, validation_1.validateNonEmptyString)(input.code, "code");
        if (!value.success)
            errors.push({ field: "code", message: value.errors[0] ?? "code cannot be empty" });
        else
            update.code = value.value;
    }
    if (input.type !== undefined) {
        if (!isTenantType(input.type))
            errors.push({ field: "type", message: "invalid type" });
        else
            update.type = input.type;
    }
    if (input.status !== undefined) {
        if (!isTenantStatus(input.status))
            errors.push({ field: "status", message: "invalid status" });
        else
            update.status = input.status;
    }
    if (input.contactEmail !== undefined) {
        if (input.contactEmail === undefined || input.contactEmail === null || input.contactEmail === "") {
            update.contactEmail = undefined;
        }
        else {
            const value = (0, validation_1.validateEmail)(input.contactEmail, "contactEmail");
            if (!value.success)
                errors.push({ field: "contactEmail", message: value.errors[0] ?? "contactEmail is invalid" });
            else
                update.contactEmail = value.value;
        }
    }
    if (input.contactPhone !== undefined) {
        if (input.contactPhone === undefined || input.contactPhone === null || input.contactPhone === "") {
            update.contactPhone = undefined;
        }
        else {
            const value = (0, validation_1.validatePhone)(input.contactPhone, "contactPhone");
            if (!value.success)
                errors.push({ field: "contactPhone", message: value.errors[0] ?? "contactPhone is invalid" });
            else
                update.contactPhone = value.value;
        }
    }
    if (input.address !== undefined) {
        update.address = (0, validation_1.optionalString)(input.address);
    }
    if (input.academicYearStartMonth !== undefined) {
        update.academicYearStartMonth = validateMonth(input.academicYearStartMonth);
    }
    if (input.deactivatedAt !== undefined) {
        if (!(input.deactivatedAt instanceof Date) || Number.isNaN(input.deactivatedAt.getTime())) {
            errors.push({ field: "deactivatedAt", message: "deactivatedAt must be a valid Date" });
        }
        else {
            update.deactivatedAt = input.deactivatedAt;
        }
    }
    if (errors.length > 0) {
        throw new errors_1.ValidationError(errors);
    }
    return update;
}
