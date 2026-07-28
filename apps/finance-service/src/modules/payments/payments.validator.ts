import { BadRequestError } from "@school-erp/errors";
import type {
  CollectPaymentInput,
  PaymentFilter,
  PaymentMethod,
  PaymentStatus,
} from "./payments.model";

const methods: PaymentMethod[] = [
  "CASH",
  "CARD",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
  "ONLINE",
];
const statuses: PaymentStatus[] = [
  "SUCCESS",
  "PARTIALLY_REFUNDED",
  "VOIDED",
  "REFUNDED",
];

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim())
    throw new BadRequestError(`${field} is required`);
  return value.trim();
}
function positive(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new BadRequestError(`${field} must be a positive integer`);
  return value;
}

export function validateCollectPayment(input: unknown): CollectPaymentInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("payment input is required");
  const value = input as Record<string, unknown>;
  const method = text(value.method, "method").toUpperCase() as PaymentMethod;
  if (!methods.includes(method))
    throw new BadRequestError("payment method is invalid");
  if (!Array.isArray(value.allocations) || !value.allocations.length)
    throw new BadRequestError("at least one allocation is required");
  const allocations = value.allocations.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new BadRequestError(`allocation ${index + 1} is invalid`);
    const row = item as Record<string, unknown>;
    const allocation = {
      feeOrderId: text(row.feeOrderId, `allocations[${index}].feeOrderId`),
      amountMinor: positive(
        row.amountMinor,
        `allocations[${index}].amountMinor`,
      ),
    };
    if (row.chargeAllocations === undefined) return allocation;
    if (!Array.isArray(row.chargeAllocations) || !row.chargeAllocations.length)
      throw new BadRequestError(
        `allocations[${index}].chargeAllocations must not be empty`,
      );
    const chargeAllocations = row.chargeAllocations.map((charge, chargeIndex) => {
      if (!charge || typeof charge !== "object" || Array.isArray(charge))
        throw new BadRequestError(
          `allocations[${index}].chargeAllocations[${chargeIndex}] is invalid`,
        );
      const chargeRow = charge as Record<string, unknown>;
      return {
        chargeId: text(
          chargeRow.chargeId,
          `allocations[${index}].chargeAllocations[${chargeIndex}].chargeId`,
        ),
        amountMinor: positive(
          chargeRow.amountMinor,
          `allocations[${index}].chargeAllocations[${chargeIndex}].amountMinor`,
        ),
      };
    });
    if (
      new Set(chargeAllocations.map((charge) => charge.chargeId)).size !==
      chargeAllocations.length
    )
      throw new BadRequestError(
        `allocations[${index}] contains a duplicate charge allocation`,
      );
    if (
      chargeAllocations.reduce((sum, charge) => sum + charge.amountMinor, 0) !==
      allocation.amountMinor
    )
      throw new BadRequestError(
        `allocations[${index}] charge allocation total must equal its payment amount`,
      );
    return { ...allocation, chargeAllocations };
  });
  if (
    new Set(allocations.map((item) => item.feeOrderId)).size !==
    allocations.length
  )
    throw new BadRequestError(
      "a fee order can be allocated only once per payment",
    );
  const result: CollectPaymentInput = {
    studentId: text(value.studentId, "studentId"),
    method,
    allocations,
    idempotencyKey: text(value.idempotencyKey, "idempotencyKey"),
  };
  if (typeof value.reference === "string" && value.reference.trim())
    result.reference = value.reference.trim();
  if (typeof value.note === "string" && value.note.trim()) {
    if (value.note.trim().length > 500)
      throw new BadRequestError("note cannot exceed 500 characters");
    result.note = value.note.trim();
  }
  if (method !== "CASH" && !result.reference)
    throw new BadRequestError(
      `reference is required for ${method.toLowerCase().replaceAll("_", " ")} payments`,
    );
  if (typeof value.paidAt === "string" && value.paidAt.trim()) {
    if (Number.isNaN(Date.parse(value.paidAt)))
      throw new BadRequestError("paidAt is invalid");
    result.paidAt = value.paidAt;
  }
  return result;
}

export function validatePaymentFilter(input: unknown): PaymentFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input))
    throw new BadRequestError("payment filter must be an object");
  const value = input as Record<string, unknown>;
  const result: PaymentFilter = {};
  for (const key of [
    "campusId",
    "academicYearId",
    "studentId",
    "search",
  ] as const)
    if (value[key] !== undefined) result[key] = text(value[key], key);
  if (value.method !== undefined) {
    const method = text(value.method, "method").toUpperCase() as PaymentMethod;
    if (!methods.includes(method))
      throw new BadRequestError("payment method is invalid");
    result.method = method;
  }
  for (const field of ["paidFrom", "paidTo"] as const) {
    if (value[field] === undefined) continue;
    const date = text(value[field], field);
    if (Number.isNaN(Date.parse(date)))
      throw new BadRequestError(`${field} must be a valid date`);
    result[field] = date;
  }
  if (
    result.paidFrom &&
    result.paidTo &&
    Date.parse(result.paidFrom) > Date.parse(result.paidTo)
  )
    throw new BadRequestError("paidFrom cannot be after paidTo");
  if (value.status !== undefined) {
    const status = text(value.status, "status").toUpperCase() as PaymentStatus;
    if (!statuses.includes(status))
      throw new BadRequestError("payment status is invalid");
    result.status = status;
  }
  for (const field of ["limit", "offset"] as const) {
    if (value[field] === undefined) continue;
    if (
      typeof value[field] !== "number" ||
      !Number.isSafeInteger(value[field]) ||
      value[field] < 0
    )
      throw new BadRequestError(`${field} must be a non-negative integer`);
    result[field] = value[field];
  }
  if ((result.limit ?? 100) > 200)
    throw new BadRequestError("limit cannot exceed 200");
  return result;
}
