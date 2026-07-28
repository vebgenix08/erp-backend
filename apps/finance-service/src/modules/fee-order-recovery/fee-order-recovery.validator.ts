import { BadRequestError } from "@school-erp/errors";
import type {
  FeeOrderRecoveryFilter,
  FeeOrderRecoveryStatus,
} from "./fee-order-recovery.model";
const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestError(`${field} is required`);
  return value.trim();
};
export function validateFeeOrderRecoveryFilter(
  input: unknown,
): FeeOrderRecoveryFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("recovery filter must be an object");
  const value = input as Record<string, unknown>,
    result: FeeOrderRecoveryFilter = {};
  for (const field of ["campusId", "academicYearId", "search"] as const)
    if (value[field] !== undefined) result[field] = text(value[field], field);
  if (value.status !== undefined) {
    const status = text(
      value.status,
      "status",
    ).toUpperCase() as FeeOrderRecoveryStatus;
    if (status !== "PENDING" && status !== "RESOLVED")
      throw new BadRequestError("recovery status is invalid");
    result.status = status;
  }
  return result;
}
