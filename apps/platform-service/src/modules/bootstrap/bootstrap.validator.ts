import { BadRequestError } from "@school-erp/errors";
import { validateEmail, validateNonEmptyString, validatePhone } from "@school-erp/validation";
import type { FirstAdminBootstrapCompleteInput, FirstAdminBootstrapCreateInput } from "./bootstrap.model";

export function validateFirstAdminBootstrapCreateInput(input: unknown): FirstAdminBootstrapCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("bootstrap input is required");
  }
  const value = input as Record<string, unknown>;
  const tenantId = validateNonEmptyString(value.tenantId, "tenantId");
  const adminName = validateNonEmptyString(value.adminName, "adminName");
  const adminEmail = validateEmail(value.adminEmail, "adminEmail");
  const adminPhone = value.adminPhone === undefined ? undefined : validatePhone(value.adminPhone, "adminPhone");

  if (!tenantId.success) throw new BadRequestError(tenantId.errors[0] ?? "tenantId is required");
  if (!adminName.success) throw new BadRequestError(adminName.errors[0] ?? "adminName is required");
  if (!adminEmail.success) throw new BadRequestError(adminEmail.errors[0] ?? "adminEmail is invalid");
  if (adminPhone !== undefined && !adminPhone.success) throw new BadRequestError(adminPhone.errors[0] ?? "adminPhone is invalid");

  return {
    tenantId: tenantId.value,
    adminName: adminName.value,
    adminEmail: adminEmail.value,
    adminPhone: adminPhone?.success ? adminPhone.value : undefined,
  };
}

export function validateFirstAdminBootstrapCompleteInput(input: unknown): FirstAdminBootstrapCompleteInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const value = input as Record<string, unknown>;
  return {
    inviteId: typeof value.inviteId === "string" && value.inviteId.trim() ? value.inviteId.trim() : undefined,
  };
}
