import { ValidationError } from "@school-erp/errors";
import type { SectionFollowUpType, SectionFollowUpVisibility } from "./teacher-section.model";

const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const requiredText = (value: unknown, field: string, maximum = 3000) => {
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

export function validateTeacherSectionInput(value: unknown) {
  const input = object(value);
  return {
    ...(optionalText(input.academicYearId)
      ? { academicYearId: optionalText(input.academicYearId)! }
      : {}),
    ...(optionalText(input.sectionId) ? { sectionId: optionalText(input.sectionId)! } : {}),
    date: optionalText(input.date)
      ? date(input.date, "date")
      : new Date().toISOString().slice(0, 10),
  };
}

export function validateSaveSectionFollowUpInput(value: unknown) {
  const input = object(value);
  const followUpType = requiredText(input.followUpType, "followUpType", 20) as SectionFollowUpType;
  const visibility = requiredText(input.visibility, "visibility", 30) as SectionFollowUpVisibility;
  if (!(["ACADEMIC", "ATTENDANCE", "GENERAL"] as string[]).includes(followUpType))
    throw new ValidationError([{ field: "followUpType", message: "followUpType is invalid" }]);
  if (!(["CLASS_TEACHER_ONLY", "ACADEMIC_TEAM"] as string[]).includes(visibility))
    throw new ValidationError([{ field: "visibility", message: "visibility is invalid" }]);
  const expectedVersion =
    input.expectedVersion === undefined ? undefined : Number(input.expectedVersion);
  if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 1))
    throw new ValidationError([
      { field: "expectedVersion", message: "expectedVersion must be a positive integer" },
    ]);
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    ...(expectedVersion ? { expectedVersion } : {}),
    academicYearId: requiredText(input.academicYearId, "academicYearId", 160),
    sectionId: requiredText(input.sectionId, "sectionId", 160),
    studentId: requiredText(input.studentId, "studentId", 160),
    followUpType,
    summary: requiredText(input.summary, "summary", 3000),
    ...(optionalText(input.nextAction)
      ? { nextAction: requiredText(input.nextAction, "nextAction", 500) }
      : {}),
    ...(optionalText(input.followUpDate)
      ? { followUpDate: date(input.followUpDate, "followUpDate") }
      : {}),
    visibility,
  };
}

export function validateResolveSectionFollowUpInput(value: unknown) {
  const input = object(value);
  const expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    throw new ValidationError([
      { field: "expectedVersion", message: "expectedVersion must be a positive integer" },
    ]);
  return { id: requiredText(input.id, "id", 160), expectedVersion };
}
