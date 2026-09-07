import { ValidationError } from "@school-erp/errors";
import type { TeacherClassWorkspaceInput } from "./teacher-classes.model";

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError([{ field: "input", message: "input must be an object" }]);
  }
  return value as Record<string, unknown>;
};

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function validateTeacherClassWorkspaceInput(value: unknown): TeacherClassWorkspaceInput {
  const input = object(value);
  const subjectOfferingId = optionalString(input.subjectOfferingId);
  if (!subjectOfferingId) {
    throw new ValidationError([
      { field: "subjectOfferingId", message: "subjectOfferingId is required" },
    ]);
  }
  const academicYearId = optionalString(input.academicYearId);
  return {
    subjectOfferingId,
    ...(academicYearId ? { academicYearId } : {}),
  };
}
