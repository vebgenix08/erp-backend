import { validationFail, validationOk, type ValidationResult } from "./result";

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateNonEmptyString(
  value: unknown,
  fieldName = "value",
): ValidationResult<string> {
  if (!isNonEmptyString(value)) {
    return validationFail(`${fieldName} must be a non-empty string`);
  }
  return validationOk(value.trim());
}

export function validateEmail(value: unknown, fieldName = "email"): ValidationResult<string> {
  const result = validateNonEmptyString(value, fieldName);
  if (!result.success) return result;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(result.value)) {
    return validationFail(`${fieldName} must be a valid email address`);
  }
  return validationOk(result.value.toLowerCase());
}

export function validatePhone(value: unknown, fieldName = "phone"): ValidationResult<string> {
  const result = validateNonEmptyString(value, fieldName);
  if (!result.success) return result;
  const phonePattern = /^[+]?[\d\s().-]{7,20}$/;
  if (!phonePattern.test(result.value)) {
    return validationFail(`${fieldName} must be a valid phone number`);
  }
  return validationOk(result.value);
}

export function validateObjectIdPlaceholder(
  value: unknown,
  fieldName = "id",
): ValidationResult<string> {
  const result = validateNonEmptyString(value, fieldName);
  if (!result.success) return result;
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(result.value)) {
    return validationFail(`${fieldName} must be an object id placeholder`);
  }
  return validationOk(result.value);
}

export function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
