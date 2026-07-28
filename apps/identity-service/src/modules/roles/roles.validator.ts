import { ValidationError } from "@school-erp/errors";
import { optionalString, validateNonEmptyString } from "@school-erp/validation";
import type { RoleCreateInput, RoleUpdateInput } from "./roles.model";

function validateBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ValidationError([{ field, message: `${field} must be a boolean` }]);
  }
  return value;
}

export function validateRoleCreateInput(input: Record<string, unknown>): RoleCreateInput {
  const code = validateNonEmptyString(input.code, "code");
  const name = validateNonEmptyString(input.name, "name");
  const errors: Array<{ field: string; message: string }> = [];

  if (!code.success) errors.push({ field: "code", message: code.errors[0] ?? "code is required" });
  if (!name.success) errors.push({ field: "name", message: name.errors[0] ?? "name is required" });
  if (errors.length > 0) throw new ValidationError(errors);

  const validatedCode = code.success ? code.value : "";
  const validatedName = name.success ? name.value : "";

  return {
    code: validatedCode,
    name: validatedName,
    description: optionalString(input.description),
    isSystemRole: validateBoolean(input.isSystemRole, "isSystemRole"),
    isActive: validateBoolean(input.isActive, "isActive"),
  };
}

export function validateRoleUpdateInput(input: Record<string, unknown>): RoleUpdateInput {
  const update: RoleUpdateInput = {};
  const errors: Array<{ field: string; message: string }> = [];

  if (input.code !== undefined) {
    const value = validateNonEmptyString(input.code, "code");
    if (!value.success) errors.push({ field: "code", message: value.errors[0] ?? "code cannot be empty" });
    else update.code = value.value;
  }

  if (input.name !== undefined) {
    const value = validateNonEmptyString(input.name, "name");
    if (!value.success) errors.push({ field: "name", message: value.errors[0] ?? "name cannot be empty" });
    else update.name = value.value;
  }

  if (input.description !== undefined) {
    update.description = optionalString(input.description);
  }

  if (input.isSystemRole !== undefined) {
    const value = validateBoolean(input.isSystemRole, "isSystemRole");
    if (value !== undefined) update.isSystemRole = value;
  }

  if (input.isActive !== undefined) {
    const value = validateBoolean(input.isActive, "isActive");
    if (value !== undefined) update.isActive = value;
  }

  if (errors.length > 0) throw new ValidationError(errors);
  return update;
}
