import { BadRequestError } from "@school-erp/errors";
import type { SelectTenantInput } from "./session.model";

export function validateSelectTenantInput(input: unknown): SelectTenantInput {
  const value = input as Record<string, unknown> | null | undefined;
  if (!value || typeof value !== "object") {
    throw new BadRequestError("select tenant input is required");
  }

  const tenantId = typeof value.tenantId === "string" ? value.tenantId.trim() : "";
  const tenantCode = typeof value.tenantCode === "string" ? value.tenantCode.trim() : "";

  if (!tenantId && !tenantCode) {
    throw new BadRequestError("tenantId or tenantCode is required");
  }

  const result: SelectTenantInput = {};
  if (tenantId) result.tenantId = tenantId;
  if (tenantCode) result.tenantCode = tenantCode;
  return result;
}
