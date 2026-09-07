import { ValidationError } from "@school-erp/errors";
import type { DailyStudentUpdateStatus } from "./daily-student-updates.model";

const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requiredText = (value: unknown, field: string, maximumLength = 5000) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new ValidationError([{ field, message: `${field} is required` }]);
  if (result.length > maximumLength) {
    throw new ValidationError([
      { field, message: `${field} must not exceed ${maximumLength} characters` },
    ]);
  }
  return result;
};

const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const date = (value: unknown, field: string) => {
  const result = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00.000Z`))) {
    throw new ValidationError([{ field, message: `${field} must be a valid YYYY-MM-DD date` }]);
  }
  return result;
};

const positiveInteger = (value: unknown, fallback: number, maximum: number) => {
  const result = Number(value ?? fallback);
  return Number.isInteger(result) && result > 0 ? Math.min(result, maximum) : fallback;
};

export function validateDailyStudentUpdatePageInput(value: unknown) {
  const input = object(value);
  const status = optionalText(input.status) as DailyStudentUpdateStatus | undefined;
  if (status && !(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).includes(status)) {
    throw new ValidationError([
      { field: "status", message: "status must be DRAFT, PUBLISHED or ARCHIVED" },
    ]);
  }
  return {
    ...(optionalText(input.academicYearId)
      ? { academicYearId: optionalText(input.academicYearId)! }
      : {}),
    ...(optionalText(input.subjectOfferingId)
      ? { subjectOfferingId: optionalText(input.subjectOfferingId)! }
      : {}),
    ...(status ? { status } : {}),
    page: positiveInteger(input.page, 1, 100_000),
    pageSize: positiveInteger(input.pageSize, 20, 100),
  };
}

export function validateSaveDailyStudentUpdateInput(value: unknown) {
  const input = object(value);
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(Number.isInteger(input.expectedVersion) && Number(input.expectedVersion) > 0
      ? { expectedVersion: Number(input.expectedVersion) }
      : {}),
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    subjectOfferingId: requiredText(input.subjectOfferingId, "subjectOfferingId", 160),
    updateDate: date(input.updateDate, "updateDate"),
    title: requiredText(input.title, "title", 160),
    message: requiredText(input.message, "message", 3000),
  };
}

export function validateDailyStudentUpdateTransitionInput(value: unknown) {
  const input = object(value);
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new ValidationError([
      { field: "expectedVersion", message: "expectedVersion must be a positive integer" },
    ]);
  }
  return {
    id: requiredText(input.id, "id", 160),
    expectedVersion,
  };
}
