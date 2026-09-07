import { ValidationError } from "@school-erp/errors";
import type {
  MentorInteractionStatus,
  MentorInteractionType,
  MentorInteractionVisibility,
} from "./teacher-mentoring.model";

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
const date = (value: unknown, field: string) => {
  const result = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00.000Z`)))
    throw new ValidationError([{ field, message: `${field} must be a valid YYYY-MM-DD date` }]);
  return result;
};
const version = (value: unknown) => {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1)
    throw new ValidationError([
      { field: "expectedVersion", message: "expectedVersion must be a positive integer" },
    ]);
  return result;
};

export function validateTeacherMentoringPageInput(value: unknown) {
  const input = object(value);
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.pageSize ?? 12);
  if (!Number.isInteger(page) || page < 1)
    throw new ValidationError([{ field: "page", message: "page must be a positive integer" }]);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new ValidationError([
      { field: "pageSize", message: "pageSize must be between 1 and 100" },
    ]);
  return {
    ...(optionalText(input.academicYearId)
      ? { academicYearId: optionalText(input.academicYearId)! }
      : {}),
    ...(optionalText(input.search) ? { search: optionalText(input.search)! } : {}),
    page,
    pageSize,
  };
}

export function validateAssignmentId(value: unknown) {
  return requiredText(object(value).assignmentId, "assignmentId", 160);
}

export function validateAssignStudentMentorInput(value: unknown) {
  const input = object(value);
  const effectiveFrom = date(input.effectiveFrom, "effectiveFrom");
  const effectiveUntil = optionalText(input.effectiveUntil)
    ? date(input.effectiveUntil, "effectiveUntil")
    : undefined;
  if (effectiveUntil && effectiveUntil < effectiveFrom)
    throw new ValidationError([
      { field: "effectiveUntil", message: "effectiveUntil cannot be before effectiveFrom" },
    ]);
  return {
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    mentorEmployeeId: requiredText(input.mentorEmployeeId, "mentorEmployeeId", 160),
    studentId: requiredText(input.studentId, "studentId", 160),
    effectiveFrom,
    ...(effectiveUntil ? { effectiveUntil } : {}),
  };
}

export function validateSaveMentorInteractionInput(value: unknown) {
  const input = object(value);
  const interactionType = requiredText(
    input.interactionType,
    "interactionType",
    20,
  ) as MentorInteractionType;
  const visibility = requiredText(
    input.visibility,
    "visibility",
    30,
  ) as MentorInteractionVisibility;
  if (
    !(["MEETING", "CALL", "ACADEMIC", "ATTENDANCE", "GENERAL"] as string[]).includes(
      interactionType,
    )
  )
    throw new ValidationError([
      { field: "interactionType", message: "interactionType is invalid" },
    ]);
  if (!(["MENTOR_ONLY", "ACADEMIC_TEAM"] as string[]).includes(visibility))
    throw new ValidationError([{ field: "visibility", message: "visibility is invalid" }]);
  const rawActions = input.actionItems ?? [];
  if (
    !Array.isArray(rawActions) ||
    rawActions.length > 20 ||
    rawActions.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > 300)
  )
    throw new ValidationError([
      { field: "actionItems", message: "actionItems must contain at most 20 concise actions" },
    ]);
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(input.expectedVersion !== undefined
      ? { expectedVersion: version(input.expectedVersion) }
      : {}),
    assignmentId: requiredText(input.assignmentId, "assignmentId", 160),
    interactionType,
    interactionDate: date(input.interactionDate, "interactionDate"),
    summary: requiredText(input.summary, "summary", 3000),
    actionItems: [...new Set(rawActions.map((item) => String(item).trim()))],
    ...(optionalText(input.followUpDate)
      ? { followUpDate: date(input.followUpDate, "followUpDate") }
      : {}),
    visibility,
  };
}

export function validateMentorInteractionStatusInput(value: unknown) {
  const input = object(value);
  const status = requiredText(input.status, "status", 20) as MentorInteractionStatus;
  if (!(["COMPLETED", "CANCELLED"] as string[]).includes(status))
    throw new ValidationError([
      { field: "status", message: "status must be COMPLETED or CANCELLED" },
    ]);
  return {
    id: requiredText(input.id, "id", 160),
    expectedVersion: version(input.expectedVersion),
    status,
  };
}
