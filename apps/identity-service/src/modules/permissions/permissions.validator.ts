import { ValidationError } from "@school-erp/errors";
import { optionalString, validateNonEmptyString } from "@school-erp/validation";
import type { PermissionCreateInput, PermissionUpdateInput } from "./permissions.model";

function validateBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ValidationError([{ field, message: `${field} must be a boolean` }]);
  }
  return value;
}

function validatePermissionCode(value: unknown, field = "code") {
  const result = validateNonEmptyString(value, field);
  if (!result.success) return result;
  if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/i.test(result.value)) {
    return { success: false as const, errors: [`${field} must match domain.resource.action`] };
  }
  return result;
}

export function validatePermissionCreateInput(input: Record<string, unknown>): PermissionCreateInput {
  const code = validatePermissionCode(input.code);
  const errors: Array<{ field: string; message: string }> = [];

  if (!code.success) errors.push({ field: "code", message: code.errors[0] ?? "code is required" });
  if (errors.length > 0) throw new ValidationError(errors);

  const validatedCode = code.success ? code.value : "";

  return {
    code: validatedCode,
    description: optionalString(input.description),
    category: optionalString(input.category),
    isSystemPermission: validateBoolean(input.isSystemPermission, "isSystemPermission"),
    isActive: validateBoolean(input.isActive, "isActive"),
  };
}

export function validatePermissionUpdateInput(input: Record<string, unknown>): PermissionUpdateInput {
  const update: PermissionUpdateInput = {};
  const errors: Array<{ field: string; message: string }> = [];

  if (input.code !== undefined) {
    const code = validatePermissionCode(input.code);
    if (!code.success) errors.push({ field: "code", message: code.errors[0] ?? "code cannot be empty" });
    else update.code = code.success ? code.value : "";
  }

  if (input.description !== undefined) {
    update.description = optionalString(input.description);
  }

  if (input.category !== undefined) {
    update.category = optionalString(input.category);
  }

  if (input.isSystemPermission !== undefined) {
    const value = validateBoolean(input.isSystemPermission, "isSystemPermission");
    if (value !== undefined) update.isSystemPermission = value;
  }

  if (input.isActive !== undefined) {
    const value = validateBoolean(input.isActive, "isActive");
    if (value !== undefined) update.isActive = value;
  }

  if (errors.length > 0) throw new ValidationError(errors);
  return update;
}
