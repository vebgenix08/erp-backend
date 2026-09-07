import { ValidationError } from "@school-erp/errors";
import type { TeacherHistoryPageInput } from "./teacher-history.model";

export function validateTeacherHistoryPageInput(value: unknown): TeacherHistoryPageInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError([{ field: "input", message: "input must be an object" }]);
  }
  const input = value as Record<string, unknown>;
  const page = input.page === undefined ? 1 : Number(input.page);
  const pageSize = input.pageSize === undefined ? 10 : Number(input.pageSize);
  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError([{ field: "page", message: "page must be a positive integer" }]);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ValidationError([
      { field: "pageSize", message: "pageSize must be between 1 and 100" },
    ]);
  }
  const academicYearId =
    typeof input.academicYearId === "string" && input.academicYearId.trim()
      ? input.academicYearId.trim()
      : undefined;
  const subjectOfferingId =
    typeof input.subjectOfferingId === "string" && input.subjectOfferingId.trim()
      ? input.subjectOfferingId.trim()
      : undefined;
  const status =
    typeof input.status === "string" && input.status.trim() ? input.status.trim() : undefined;
  return {
    page,
    pageSize,
    ...(academicYearId ? { academicYearId } : {}),
    ...(subjectOfferingId ? { subjectOfferingId } : {}),
    ...(status ? { status } : {}),
  };
}
