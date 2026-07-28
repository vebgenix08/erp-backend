import { ValidationError } from "@school-erp/errors";
import type { CreateGeneralChargeInput, GeneralChargeFilter, GeneralChargeTargetType } from "./general-charges.model";

function text(value: unknown, field: string, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ValidationError([{ field, message: `${field} is required` }]);
  return value.trim();
}

function optionalText(value: unknown, field: string, max: number) {
  if (value === undefined || value === null || value === "") return undefined;
  return text(value, field, max);
}

export function validateCreateGeneralCharge(input: unknown): CreateGeneralChargeInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "input", message: "general charge input is required" }]);
  const value = input as Record<string, unknown>;
  if (!Number.isSafeInteger(value.amountMinor) || (value.amountMinor as number) <= 0)
    throw new ValidationError([{ field: "amountMinor", message: "amountMinor must be a positive integer" }]);
  const policy = text(value.collectionPolicy, "collectionPolicy") as CreateGeneralChargeInput["collectionPolicy"];
  if (!["FULL_ONLY", "PARTIAL_ALLOWED"].includes(policy))
    throw new ValidationError([{ field: "collectionPolicy", message: "collectionPolicy is invalid" }]);
  if (!value.target || typeof value.target !== "object" || Array.isArray(value.target))
    throw new ValidationError([{ field: "target", message: "target is required" }]);
  const target = value.target as Record<string, unknown>;
  const type = text(target.type, "target.type") as GeneralChargeTargetType;
  if (!["STUDENT", "CLASS", "SECTION"].includes(type))
    throw new ValidationError([{ field: "target.type", message: "target type is invalid" }]);
  if (!Array.isArray(target.ids) || !target.ids.length || target.ids.length > 500)
    throw new ValidationError([{ field: "target.ids", message: "target ids must contain between 1 and 500 values" }]);
  const ids = [...new Set(target.ids.map((item) => text(item, "target.ids", 120)))];
  const note = optionalText(value.note, "note", 500);
  return {
    campusId: text(value.campusId, "campusId"),
    academicYearId: text(value.academicYearId, "academicYearId"),
    name: text(value.name, "name"),
    ...(note ? { note } : {}),
    feeHeadId: text(value.feeHeadId, "feeHeadId"),
    amountMinor: value.amountMinor as number,
    collectionPolicy: policy,
    target: { type, ids },
    idempotencyKey: text(value.idempotencyKey, "idempotencyKey"),
  };
}

export function validateGeneralChargeFilter(input: unknown): GeneralChargeFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "filter", message: "filter must be an object" }]);
  const value = input as Record<string, unknown>;
  const result: GeneralChargeFilter = {};
  if (value.campusId !== undefined) result.campusId = text(value.campusId, "campusId");
  if (value.academicYearId !== undefined) result.academicYearId = text(value.academicYearId, "academicYearId");
  if (value.status !== undefined) {
    const status = text(value.status, "status") as NonNullable<GeneralChargeFilter["status"]>;
    if (!["ASSIGNING", "ASSIGNED", "FAILED"].includes(status))
      throw new ValidationError([{ field: "status", message: "status is invalid" }]);
    result.status = status;
  }
  return result;
}
