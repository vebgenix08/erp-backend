import { ValidationError } from "@school-erp/errors";
import type {
  SaveTeacherAttendanceInput,
  StudentAttendanceStatus,
  TeacherAttendanceWorkspaceInput,
} from "./attendance.model";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function date(value: unknown, field: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!datePattern.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00.000Z`))) {
    throw new ValidationError([{ field, message: `${field} must be a valid YYYY-MM-DD date` }]);
  }
  return normalized;
}

function optionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function validateTeacherAttendanceWorkspaceInput(
  value: unknown,
): TeacherAttendanceWorkspaceInput {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const academicYearId = optionalId(input.academicYearId);
  const campusId = optionalId(input.campusId);
  const lessonId = optionalId(input.lessonId);
  return {
    date: date(input.date, "date"),
    ...(academicYearId ? { academicYearId } : {}),
    ...(campusId ? { campusId } : {}),
    ...(lessonId ? { lessonId } : {}),
  };
}

export function validateSaveTeacherAttendanceInput(value: unknown): SaveTeacherAttendanceInput {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const base = validateTeacherAttendanceWorkspaceInput(input);
  const lessonId = optionalId(input.lessonId);
  if (!lessonId)
    throw new ValidationError([{ field: "lessonId", message: "lessonId is required" }]);
  if (!Array.isArray(input.students)) {
    throw new ValidationError([{ field: "students", message: "students is required" }]);
  }
  const seen = new Set<string>();
  const students = input.students.map((value, index) => {
    const row =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const studentId = optionalId(row.studentId);
    const status = row.status as StudentAttendanceStatus;
    if (!studentId)
      throw new ValidationError([
        { field: `students.${index}.studentId`, message: "studentId is required" },
      ]);
    if (seen.has(studentId))
      throw new ValidationError([
        { field: `students.${index}.studentId`, message: "studentId must be unique" },
      ]);
    if (status !== "PRESENT" && status !== "ABSENT") {
      throw new ValidationError([
        { field: `students.${index}.status`, message: "status must be PRESENT or ABSENT" },
      ]);
    }
    seen.add(studentId);
    return { studentId, status };
  });
  return {
    ...base,
    lessonId,
    submit: input.submit === true,
    students,
    ...(Number.isInteger(input.expectedVersion) && Number(input.expectedVersion) >= 1
      ? { expectedVersion: Number(input.expectedVersion) }
      : {}),
  };
}
