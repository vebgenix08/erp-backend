import { ValidationError } from "@school-erp/errors";
import type { FeeOrderFilter } from "./fee-orders.model";

const statuses = new Set(["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED"]);
const sourceTypes = new Set(["ANNUAL", "GENERAL", "TRANSFER_ADJUSTMENT"]);

export function validateFeeOrderFilter(value: unknown): FeeOrderFilter {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError([
      { field: "filter", message: "filter must be an object" },
    ]);
  }
  const input = value as Record<string, unknown>;
  const result: FeeOrderFilter = {};
  for (const key of [
    "campusId",
    "academicYearId",
    "studentId",
    "classId",
    "sectionId",
    "search",
  ] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string" || !input[key].trim())
        throw new ValidationError([
          { field: key, message: `${key} must be a non-empty string` },
        ]);
      result[key] = input[key].trim();
    }
  }
  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !statuses.has(input.status))
      throw new ValidationError([
        { field: "status", message: "status is invalid" },
      ]);
    result.status = input.status as Exclude<
      FeeOrderFilter["status"],
      undefined
    >;
  }
  if (input.sourceType !== undefined) {
    if (typeof input.sourceType !== "string" || !sourceTypes.has(input.sourceType))
      throw new ValidationError([
        { field: "sourceType", message: "sourceType is invalid" },
      ]);
    result.sourceType = input.sourceType as Exclude<
      FeeOrderFilter["sourceType"],
      undefined
    >;
  }
  for (const field of ["limit", "offset"] as const) {
    if (input[field] === undefined) continue;
    if (
      typeof input[field] !== "number" ||
      !Number.isSafeInteger(input[field]) ||
      input[field] < 0
    )
      throw new ValidationError([
        { field, message: `${field} must be a non-negative integer` },
      ]);
    result[field] = input[field];
  }
  if ((result.limit ?? 100) > 200)
    throw new ValidationError([
      { field: "limit", message: "limit cannot exceed 200" },
    ]);
  return result;
}
