import { ValidationError } from "@school-erp/errors";
import type { TenantStatus, TenantType } from "@school-erp/types";
import {
  optionalString,
  validateEmail,
  validateNonEmptyString,
  validatePhone,
} from "@school-erp/validation";
import type { TenantCreateInput, TenantUpdateInput } from "./tenants.model";

function isTenantType(value: unknown): value is TenantType {
  return value === "INSTITUTION" || value === "SCHOOL" || value === "COLLEGE" || value === "DEGREE_COLLEGE";
}

function isTenantStatus(value: unknown): value is TenantStatus {
  return value === "ONBOARDING" || value === "ACTIVE" || value === "INACTIVE" || value === "SUSPENDED" || value === "DELETION_PENDING";
}

function validateMonth(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new ValidationError([{ field: "academicYearStartMonth", message: "must be an integer between 1 and 12" }]);
  }
  return month;
}

export function validateTenantCreateInput(input: Record<string, unknown>): TenantCreateInput {
  const name = validateNonEmptyString(input.name, "name");
  const code = validateNonEmptyString(input.code, "code");
  const clientRequestId = validateNonEmptyString(input.clientRequestId, "clientRequestId");
  const contactEmail = input.contactEmail === undefined ? undefined : validateEmail(input.contactEmail, "contactEmail");
  const contactPhone = input.contactPhone === undefined ? undefined : validatePhone(input.contactPhone, "contactPhone");
  const address = optionalString(input.address);
  const type = input.type;
  const errors: Array<{ field: string; message: string }> = [];

  if (!name.success) errors.push({ field: "name", message: name.errors[0] ?? "name is required" });
  if (!code.success) errors.push({ field: "code", message: code.errors[0] ?? "code is required" });
  if (!clientRequestId.success) errors.push({ field: "clientRequestId", message: clientRequestId.errors[0] ?? "clientRequestId is required" });
  if (!isTenantType(type)) errors.push({ field: "type", message: "type is required" });
  if (contactEmail !== undefined && !contactEmail.success) errors.push({ field: "contactEmail", message: contactEmail.errors[0] ?? "contactEmail is invalid" });
  if (contactPhone !== undefined && !contactPhone.success) errors.push({ field: "contactPhone", message: contactPhone.errors[0] ?? "contactPhone is invalid" });

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  const validatedName = name.success ? name.value : "";
  const validatedCode = code.success ? code.value : "";
  const validatedType = type as TenantType;

  return {
    name: validatedName,
    slug: optionalString(input.slug),
    code: validatedCode,
    clientRequestId: clientRequestId.success ? clientRequestId.value : "",
    type: validatedType,
    contactEmail: contactEmail?.success ? contactEmail.value : undefined,
    contactPhone: contactPhone?.success ? contactPhone.value : undefined,
    address,
    academicYearStartMonth: validateMonth(input.academicYearStartMonth),
  };
}

export function validateTenantUpdateInput(input: Record<string, unknown>): TenantUpdateInput {
  const update: TenantUpdateInput = {};
  const errors: Array<{ field: string; message: string }> = [];

  if (input.name !== undefined) {
    const value = validateNonEmptyString(input.name, "name");
    if (!value.success) errors.push({ field: "name", message: value.errors[0] ?? "name cannot be empty" });
    else update.name = value.value;
  }
  if (input.slug !== undefined) update.slug = optionalString(input.slug);

  if (input.code !== undefined) {
    const value = validateNonEmptyString(input.code, "code");
    if (!value.success) errors.push({ field: "code", message: value.errors[0] ?? "code cannot be empty" });
    else update.code = value.value;
  }

  if (input.type !== undefined) {
    if (!isTenantType(input.type)) errors.push({ field: "type", message: "invalid type" });
    else update.type = input.type as TenantType;
  }

  if (input.status !== undefined) {
    if (!isTenantStatus(input.status)) errors.push({ field: "status", message: "invalid status" });
    else update.status = input.status as TenantStatus;
  }

  if (input.contactEmail !== undefined) {
    if (input.contactEmail === undefined || input.contactEmail === null || input.contactEmail === "") {
      update.contactEmail = undefined;
    } else {
      const value = validateEmail(input.contactEmail, "contactEmail");
      if (!value.success) errors.push({ field: "contactEmail", message: value.errors[0] ?? "contactEmail is invalid" });
      else update.contactEmail = value.value;
    }
  }

  if (input.contactPhone !== undefined) {
    if (input.contactPhone === undefined || input.contactPhone === null || input.contactPhone === "") {
      update.contactPhone = undefined;
    } else {
      const value = validatePhone(input.contactPhone, "contactPhone");
      if (!value.success) errors.push({ field: "contactPhone", message: value.errors[0] ?? "contactPhone is invalid" });
      else update.contactPhone = value.value;
    }
  }

  if (input.address !== undefined) {
    update.address = optionalString(input.address);
  }

  if (input.academicYearStartMonth !== undefined) {
    update.academicYearStartMonth = validateMonth(input.academicYearStartMonth);
  }

  if (input.deactivatedAt !== undefined) {
    if (!(input.deactivatedAt instanceof Date) || Number.isNaN(input.deactivatedAt.getTime())) {
      errors.push({ field: "deactivatedAt", message: "deactivatedAt must be a valid Date" });
    } else {
      update.deactivatedAt = input.deactivatedAt;
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  return update;
}
