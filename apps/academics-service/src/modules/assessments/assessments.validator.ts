import { ValidationError } from "@school-erp/errors";
import type { AssessmentDefinitionStatus, StudentMarkStatus } from "./assessments.model";

const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, field: string) => {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new ValidationError([{ field, message: `${field} is required` }]);
  return result;
};
const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const date = (value: unknown, field: string) => {
  const result = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00.000Z`))) {
    throw new ValidationError([{ field, message: `${field} must be a valid YYYY-MM-DD date` }]);
  }
  return result;
};
const positive = (value: unknown, field: string) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new ValidationError([{ field, message: `${field} must be greater than zero` }]);
  }
  return result;
};

export function validateAssessmentDefinitionInput(value: unknown) {
  const input = object(value);
  const attendanceWindowStart = date(input.attendanceWindowStart, "attendanceWindowStart");
  const attendanceWindowEnd = date(input.attendanceWindowEnd, "attendanceWindowEnd");
  const assessmentDate = date(input.assessmentDate, "assessmentDate");
  if (attendanceWindowStart > attendanceWindowEnd || attendanceWindowEnd > assessmentDate) {
    throw new ValidationError([
      {
        field: "attendanceWindow",
        message: "attendance window must end on or before the assessment date",
      },
    ]);
  }
  return {
    ...(optionalText(input.id) ? { id: optionalText(input.id)! } : {}),
    campusId: text(input.campusId, "campusId"),
    academicYearId: text(input.academicYearId, "academicYearId"),
    ...(optionalText(input.classId) ? { classId: optionalText(input.classId)! } : {}),
    name: text(input.name, "name"),
    assessmentDate,
    attendanceWindowStart,
    attendanceWindowEnd,
    maximumMarks: positive(input.maximumMarks, "maximumMarks"),
    sequence: Math.max(1, Math.trunc(positive(input.sequence, "sequence"))),
    ...(Number.isInteger(input.expectedVersion) && Number(input.expectedVersion) >= 1
      ? { expectedVersion: Number(input.expectedVersion) }
      : {}),
  };
}

export function validateAssessmentStatus(value: unknown) {
  const input = object(value);
  const status = input.status as AssessmentDefinitionStatus;
  if (!(["DRAFT", "OPEN", "CLOSED"] as const).includes(status)) {
    throw new ValidationError([
      { field: "status", message: "status must be DRAFT, OPEN or CLOSED" },
    ]);
  }
  return {
    id: text(input.id, "id"),
    status,
    expectedVersion: Math.trunc(positive(input.expectedVersion, "expectedVersion")),
  };
}

export function validateTeacherMarksWorkspaceInput(value: unknown) {
  const input = object(value);
  return {
    ...(optionalText(input.academicYearId)
      ? { academicYearId: optionalText(input.academicYearId)! }
      : {}),
    ...(optionalText(input.campusId) ? { campusId: optionalText(input.campusId)! } : {}),
    ...(optionalText(input.subjectOfferingId)
      ? { subjectOfferingId: optionalText(input.subjectOfferingId)! }
      : {}),
    ...(optionalText(input.assessmentId)
      ? { assessmentId: optionalText(input.assessmentId)! }
      : {}),
  };
}

export function validateSaveTeacherMarksInput(value: unknown) {
  const input = object(value);
  if (!Array.isArray(input.students)) {
    throw new ValidationError([{ field: "students", message: "students is required" }]);
  }
  const seen = new Set<string>();
  const students = input.students.map((value, index) => {
    const row = object(value);
    const studentId = text(row.studentId, `students.${index}.studentId`);
    if (seen.has(studentId))
      throw new ValidationError([
        { field: `students.${index}.studentId`, message: "studentId must be unique" },
      ]);
    seen.add(studentId);
    const status = row.status as StudentMarkStatus;
    if (!(["NOT_RECORDED", "RECORDED", "ABSENT"] as const).includes(status)) {
      throw new ValidationError([
        { field: `students.${index}.status`, message: "invalid mark status" },
      ]);
    }
    const marks =
      row.marks === undefined || row.marks === null || row.marks === ""
        ? undefined
        : Number(row.marks);
    if (status === "RECORDED" && (!Number.isFinite(marks) || Number(marks) < 0)) {
      throw new ValidationError([
        { field: `students.${index}.marks`, message: "marks are required when status is RECORDED" },
      ]);
    }
    return { studentId, status, ...(marks !== undefined ? { marks } : {}) };
  });
  return {
    academicYearId: text(input.academicYearId, "academicYearId"),
    subjectOfferingId: text(input.subjectOfferingId, "subjectOfferingId"),
    assessmentId: text(input.assessmentId, "assessmentId"),
    submit: input.submit === true,
    students,
    ...(Number.isInteger(input.expectedVersion) && Number(input.expectedVersion) >= 1
      ? { expectedVersion: Number(input.expectedVersion) }
      : {}),
  };
}
