import { ValidationError } from "@school-erp/errors";
import type { UserStatus } from "@school-erp/types";
import { optionalString, validateEmail, validateNonEmptyString } from "@school-erp/validation";
import type { UserCreateInput, UserUpdateInput } from "./users.model";

function isUserStatus(value: unknown): value is UserStatus {
  return value === "ACTIVE" || value === "INACTIVE" || value === "SUSPENDED" || value === "INVITED";
}

function validateTimestamp(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ValidationError([{ field, message: `${field} must be a valid Date` }]);
  }
  return value;
}

export function validateUserCreateInput(input: Record<string, unknown>): UserCreateInput {
  const name = validateNonEmptyString(input.name, "name");
  const email = validateEmail(input.email, "email");
  const errors: Array<{ field: string; message: string }> = [];

  if (!name.success) errors.push({ field: "name", message: name.errors[0] ?? "name is required" });
  if (!email.success) errors.push({ field: "email", message: email.errors[0] ?? "email is required" });
  if (input.status !== undefined && !isUserStatus(input.status)) {
    errors.push({ field: "status", message: "status must be one of ACTIVE, INACTIVE, SUSPENDED, INVITED" });
  }
  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  const validatedName = name.success ? name.value : "";
  const validatedEmail = email.success ? email.value : "";

  return {
    name: validatedName,
    email: validatedEmail,
    authUserId: optionalString(input.authUserId),
    status: input.status as UserStatus | undefined,
  };
}

export function validateUserUpdateInput(input: Record<string, unknown>): UserUpdateInput {
  const update: UserUpdateInput = {};
  const errors: Array<{ field: string; message: string }> = [];

  if (input.name !== undefined) {
    const name = validateNonEmptyString(input.name, "name");
    if (!name.success) errors.push({ field: "name", message: name.errors[0] ?? "name cannot be empty" });
    else update.name = name.value;
  }

  if (input.email !== undefined) {
    const email = validateEmail(input.email, "email");
    if (!email.success) errors.push({ field: "email", message: email.errors[0] ?? "email is invalid" });
    else update.email = email.value;
  }

  if (input.authUserId !== undefined) {
    update.authUserId = optionalString(input.authUserId);
  }

  if (input.status !== undefined) {
    if (!isUserStatus(input.status)) {
      errors.push({ field: "status", message: "invalid status" });
    } else {
      update.status = input.status;
    }
  }

  if (input.deactivatedAt !== undefined) {
    const deactivatedAt = validateTimestamp(input.deactivatedAt, "deactivatedAt");
    if (deactivatedAt) {
      update.deactivatedAt = deactivatedAt;
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }

  return update;
}
