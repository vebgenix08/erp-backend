import { BadRequestError } from "@school-erp/errors";
import type {
  CreatePaymentAdjustmentInput,
  PaymentAdjustmentFilter,
  PaymentAdjustmentType,
} from "./payment-adjustments.model";

const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestError(`${field} is required`);
  return value.trim();
};
export function validatePaymentAdjustment(
  input: unknown,
): CreatePaymentAdjustmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("payment adjustment input is required");
  const value = input as Record<string, unknown>;
  const type = text(value.type, "type").toUpperCase() as PaymentAdjustmentType;
  if (type !== "VOID" && type !== "REFUND")
    throw new BadRequestError("type must be VOID or REFUND");
  const result: CreatePaymentAdjustmentInput = {
    paymentId: text(value.paymentId, "paymentId"),
    type,
    reason: text(value.reason, "reason"),
    idempotencyKey: text(value.idempotencyKey, "idempotencyKey"),
  };
  if (result.reason.length < 10)
    throw new BadRequestError("reason must contain at least 10 characters");
  if (type === "REFUND") {
    if (
      typeof value.amountMinor !== "number" ||
      !Number.isSafeInteger(value.amountMinor) ||
      value.amountMinor <= 0
    )
      throw new BadRequestError(
        "amountMinor must be a positive integer for a refund",
      );
    result.amountMinor = value.amountMinor;
  }
  return result;
}
export function validatePaymentAdjustmentFilter(
  input: unknown,
): PaymentAdjustmentFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("adjustment filter must be an object");
  const value = input as Record<string, unknown>;
  const result: PaymentAdjustmentFilter = {};
  for (const field of ["paymentId", "campusId", "academicYearId"] as const)
    if (value[field] !== undefined) result[field] = text(value[field], field);
  if (value.type !== undefined) {
    const type = text(
      value.type,
      "type",
    ).toUpperCase() as PaymentAdjustmentType;
    if (type !== "VOID" && type !== "REFUND")
      throw new BadRequestError("adjustment type is invalid");
    result.type = type;
  }
  return result;
}
