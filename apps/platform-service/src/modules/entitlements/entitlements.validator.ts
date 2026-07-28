import { BadRequestError } from "@school-erp/errors";
import type {
  TenantEntitlementInput,
  TenantEntitlementStatus,
} from "./entitlements.model";
import { isTenantCapabilityCode } from "../capability-catalog/capability-catalog.service";
export function validateTenantEntitlementInput(
  input: unknown,
): TenantEntitlementInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("entitlement input is required");
  const value = input as Record<string, unknown>;
  const tenantId =
    typeof value.tenantId === "string" ? value.tenantId.trim() : "";
  const featureCode =
    typeof value.featureCode === "string"
      ? value.featureCode.trim().toUpperCase()
      : "";
  const status =
    typeof value.status === "string"
      ? (value.status.toUpperCase() as TenantEntitlementStatus)
      : "ENABLED";
  if (!tenantId) throw new BadRequestError("tenantId is required");
  if (!featureCode) throw new BadRequestError("featureCode is required");
  if (!isTenantCapabilityCode(featureCode))
    throw new BadRequestError("featureCode is not an assignable tenant capability");
  if (status !== "ENABLED" && status !== "DISABLED")
    throw new BadRequestError("status is invalid");
  const limits =
    value.limits &&
    typeof value.limits === "object" &&
    !Array.isArray(value.limits)
      ? (value.limits as Record<string, number>)
      : undefined;
  if (
    limits &&
    Object.values(limits).some((limit) => !Number.isInteger(limit) || limit < 0)
  )
    throw new BadRequestError(
      "entitlement limits must be non-negative integers",
    );
  return { tenantId, featureCode, status, limits };
}
