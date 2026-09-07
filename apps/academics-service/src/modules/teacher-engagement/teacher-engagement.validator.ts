import { ValidationError } from "@school-erp/errors";

const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const requiredText = (value: unknown, field: string, maximum = 5000) => {
  const result = optionalText(value);
  if (!result) throw new ValidationError([{ field, message: `${field} is required` }]);
  if (result.length > maximum)
    throw new ValidationError([
      { field, message: `${field} must not exceed ${maximum} characters` },
    ]);
  return result;
};
const bounded = (value: unknown, field: string, maximum: number) => {
  const result = optionalText(value);
  if (result && result.length > maximum)
    throw new ValidationError([
      { field, message: `${field} must not exceed ${maximum} characters` },
    ]);
  return result;
};
const date = (value: unknown, field: string) => {
  const result = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00.000Z`)))
    throw new ValidationError([{ field, message: `${field} must be a valid YYYY-MM-DD date` }]);
  return result;
};
const integer = (value: unknown, fallback: number, maximum: number) => {
  const result = Number(value ?? fallback);
  return Number.isInteger(result) && result > 0 ? Math.min(result, maximum) : fallback;
};
const version = (value: unknown) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
const ids = (value: unknown, field: string) => {
  if (value === undefined || value === null) return [];
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    value.some((item) => typeof item !== "string" || !item.trim())
  )
    throw new ValidationError([{ field, message: `${field} must contain at most 20 identifiers` }]);
  return [...new Set(value.map((item) => String(item).trim()))];
};

export function validateEngagementPageInput(value: unknown, statuses: readonly string[]) {
  const input = object(value);
  const status = optionalText(input.status);
  if (status && !statuses.includes(status))
    throw new ValidationError([{ field: "status", message: "status is invalid" }]);
  return {
    ...(optionalText(input.academicYearId)
      ? { academicYearId: optionalText(input.academicYearId)! }
      : {}),
    ...(optionalText(input.subjectOfferingId)
      ? { subjectOfferingId: optionalText(input.subjectOfferingId)! }
      : {}),
    ...(optionalText(input.courseworkId)
      ? { courseworkId: optionalText(input.courseworkId)! }
      : {}),
    ...(status ? { status } : {}),
    page: integer(input.page, 1, 100_000),
    pageSize: integer(input.pageSize, 20, 100),
  };
}

export function validateSaveCourseworkInput(value: unknown) {
  const input = object(value);
  const assignedDate = date(input.assignedDate, "assignedDate");
  const submissionDate = optionalText(input.submissionDate)
    ? date(input.submissionDate, "submissionDate")
    : undefined;
  if (submissionDate && submissionDate < assignedDate)
    throw new ValidationError([
      { field: "submissionDate", message: "submissionDate cannot be before assignedDate" },
    ]);
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(version(input.expectedVersion) ? { expectedVersion: version(input.expectedVersion)! } : {}),
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    subjectOfferingId: requiredText(input.subjectOfferingId, "subjectOfferingId", 160),
    title: requiredText(input.title, "title", 180),
    instructions: requiredText(input.instructions, "instructions", 5000),
    assignedDate,
    ...(submissionDate ? { submissionDate } : {}),
    resourceIds: ids(input.resourceIds, "resourceIds"),
  };
}

export function validateReviewSubmissionInput(value: unknown) {
  const input = object(value);
  const status = requiredText(input.status, "status", 10);
  if (!(status === "REVIEWED" || status === "RETURNED"))
    throw new ValidationError([
      { field: "status", message: "status must be REVIEWED or RETURNED" },
    ]);
  return {
    id: requiredText(input.id, "id", 160),
    expectedVersion: requiredVersion(input.expectedVersion),
    status: status as "REVIEWED" | "RETURNED",
    ...(bounded(input.feedback, "feedback", 3000)
      ? { feedback: bounded(input.feedback, "feedback", 3000)! }
      : {}),
  };
}

export function validateReplyDoubtInput(value: unknown) {
  const input = object(value);
  return {
    id: requiredText(input.id, "id", 160),
    expectedVersion: requiredVersion(input.expectedVersion),
    message: requiredText(input.message, "message", 4000),
    fileIds: ids(input.fileIds, "fileIds"),
  };
}
export function validateTransitionInput(value: unknown) {
  const input = object(value);
  return {
    id: requiredText(input.id, "id", 160),
    expectedVersion: requiredVersion(input.expectedVersion),
    ...(optionalText(input.status) ? { status: optionalText(input.status)! } : {}),
  };
}
function requiredVersion(value: unknown) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1)
    throw new ValidationError([
      { field: "expectedVersion", message: "expectedVersion must be a positive integer" },
    ]);
  return result;
}
