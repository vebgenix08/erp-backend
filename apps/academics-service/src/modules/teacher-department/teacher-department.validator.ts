import { ValidationError } from "@school-erp/errors";
import type { TeacherDepartmentWorkspaceInput } from "./teacher-department.model";

export function validateTeacherDepartmentInput(value: unknown): TeacherDepartmentWorkspaceInput {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const errors: Array<{ field: string; message: string }> = [];
  const optional = (field: string) => {
    const raw = input[field];
    if (raw === undefined || raw === null || raw === "") return undefined;
    if (typeof raw !== "string" || !raw.trim()) {
      errors.push({ field, message: `${field} must be a non-empty string` });
      return undefined;
    }
    return raw.trim();
  };
  const academicYearId = optional("academicYearId");
  const responsibilityId = optional("responsibilityId");
  const campusId = optional("campusId");
  const date = optional("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push({ field: "date", message: "date must use YYYY-MM-DD" });
  }
  if (errors.length) throw new ValidationError(errors);
  return {
    ...(academicYearId ? { academicYearId } : {}),
    ...(responsibilityId ? { responsibilityId } : {}),
    ...(campusId ? { campusId } : {}),
    ...(date ? { date } : {}),
  };
}
