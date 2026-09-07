import { ValidationError } from "@school-erp/errors";
import { validateEmail, validatePhone } from "@school-erp/validation";
import type {
  CreateStudentFromAdmissionInput,
  StudentGender,
  StudentListFilter,
  StudentStatus,
  StudentSortField,
  SortDirection,
  ChangeStudentEnrollmentInput,
  ClassRegistrationNumberingInput,
  SectionRollNumberingInput,
  UpdateStudentInput,
} from "./students.model";
const required = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim())
    throw new ValidationError([{ field, message: `${field} is required` }]);
  return value.trim();
};
const optional = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const nullable = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function validateUpdateStudent(input: unknown): UpdateStudentInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  const value = input as Record<string, unknown>;
  const phone = validatePhone(value.phone, "phone");
  if (!phone.success)
    throw new ValidationError(phone.errors.map((message) => ({ field: "phone", message })));
  const emailValue = nullable(value.email);
  const email = emailValue ? validateEmail(emailValue, "email") : null;
  if (email && !email.success)
    throw new ValidationError(email.errors.map((message) => ({ field: "email", message })));
  const guardianPhoneValue = nullable(value.guardianPhone);
  const guardianPhone = guardianPhoneValue
    ? validatePhone(guardianPhoneValue, "guardianPhone")
    : null;
  if (guardianPhone && !guardianPhone.success)
    throw new ValidationError(
      guardianPhone.errors.map((message) => ({ field: "guardianPhone", message })),
    );
  const dateOfBirth = nullable(value.dateOfBirth);
  if (dateOfBirth && Number.isNaN(Date.parse(dateOfBirth)))
    throw new ValidationError([{ field: "dateOfBirth", message: "dateOfBirth is invalid" }]);
  const genderValue = nullable(value.gender)?.toUpperCase() as StudentGender | null;
  if (genderValue && !(["MALE", "FEMALE", "OTHER"] as string[]).includes(genderValue))
    throw new ValidationError([{ field: "gender", message: "gender is invalid" }]);
  return {
    name: required(value.name, "name"),
    dateOfBirth,
    gender: genderValue,
    phone: phone.value,
    email: email?.value ?? null,
    address: nullable(value.address),
    guardianName: required(value.guardianName, "guardianName"),
    guardianPhone: guardianPhone?.value ?? null,
    guardianRelation: nullable(value.guardianRelation),
  };
}
export function validateCreateStudentFromAdmission(
  input: unknown,
): CreateStudentFromAdmissionInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  const value = input as Record<string, unknown>;
  const gender = optional(value.gender)?.toUpperCase() as StudentGender | undefined;
  if (gender && !(["MALE", "FEMALE", "OTHER"] as string[]).includes(gender))
    throw new ValidationError([{ field: "gender", message: "gender is invalid" }]);
  const confirmedAt = required(value.confirmedAt, "confirmedAt");
  if (Number.isNaN(Date.parse(confirmedAt)))
    throw new ValidationError([{ field: "confirmedAt", message: "confirmedAt is invalid" }]);
  const result: CreateStudentFromAdmissionInput = {
    admissionApplicationId: required(value.admissionApplicationId, "admissionApplicationId"),
    admissionNumber: required(value.admissionNumber, "admissionNumber"),
    campusId: required(value.campusId, "campusId"),
    academicYearId: required(value.academicYearId, "academicYearId"),
    classId: required(value.classId, "classId"),
    studentName: required(value.studentName, "studentName"),
    phone: required(value.phone, "phone"),
    parentName: required(value.parentName, "parentName"),
    confirmedBy: required(value.confirmedBy, "confirmedBy"),
    confirmedAt,
  };
  for (const [field, key] of [
    ["sectionId", "sectionId"],
    ["dateOfBirth", "dateOfBirth"],
    ["email", "email"],
    ["address", "address"],
    ["parentPhone", "parentPhone"],
    ["parentRelation", "parentRelation"],
  ] as const) {
    const normalized = optional(value[field]);
    if (normalized) result[key] = normalized;
  }
  if (result.dateOfBirth && Number.isNaN(Date.parse(result.dateOfBirth)))
    throw new ValidationError([{ field: "dateOfBirth", message: "dateOfBirth is invalid" }]);
  if (gender) result.gender = gender;
  return result;
}
export function validateClassRegistrationNumbering(
  input: unknown,
): ClassRegistrationNumberingInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  const value = input as Record<string, unknown>;
  return {
    campusId: required(value.campusId, "campusId"),
    academicYearId: required(value.academicYearId, "academicYearId"),
    classId: required(value.classId, "classId"),
    clientRequestId: required(value.clientRequestId, "clientRequestId"),
  };
}
export function validateSectionRollNumbering(input: unknown): SectionRollNumberingInput {
  const base = validateClassRegistrationNumbering(input);
  const value = input as Record<string, unknown>;
  if (typeof value.regenerate !== "boolean")
    throw new ValidationError([{ field: "regenerate", message: "regenerate must be a boolean" }]);
  return {
    ...base,
    sectionId: required(value.sectionId, "sectionId"),
    regenerate: value.regenerate,
  };
}
export function validateChangeStudentEnrollment(input: unknown): ChangeStudentEnrollmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "input", message: "input is required" }]);
  const value = input as Record<string, unknown>;
  const result: ChangeStudentEnrollmentInput = {
    campusId: required(value.campusId, "campusId"),
    academicYearId: required(value.academicYearId, "academicYearId"),
    classId: required(value.classId, "classId"),
    reason: required(value.reason, "reason"),
  };
  const sectionId = optional(value.sectionId);
  if (sectionId) result.sectionId = sectionId;
  return result;
}
export function validateStudentFilter(input: unknown): StudentListFilter {
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input))
    throw new ValidationError([{ field: "filter", message: "filter must be an object" }]);
  const value = input as Record<string, unknown>,
    result: StudentListFilter = {};
  for (const key of ["campusId", "academicYearId", "classId", "sectionId", "search"] as const) {
    const normalized = optional(value[key]);
    if (normalized) result[key] = normalized;
  }
  const status = optional(value.status)?.toUpperCase() as StudentStatus | undefined;
  if (status) {
    if (!(["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"] as string[]).includes(status))
      throw new ValidationError([{ field: "status", message: "status is invalid" }]);
    result.status = status;
  }
  for (const key of ["limit", "offset", "page", "pageSize"] as const) {
    const number = value[key];
    if (number !== undefined) {
      if (
        typeof number !== "number" ||
        !Number.isSafeInteger(number) ||
        number < 0 ||
        ((key === "limit" || key === "pageSize") && (number < 1 || number > 100)) ||
        (key === "page" && number < 1)
      )
        throw new ValidationError([{ field: key, message: `${key} is invalid` }]);
      result[key] = number;
    }
  }
  const sortBy = optional(value.sortBy);
  if (sortBy) {
    if (!["name", "admissionNumber", "registrationNumber", "createdAt"].includes(sortBy))
      throw new ValidationError([{ field: "sortBy", message: "sortBy is invalid" }]);
    result.sortBy = sortBy as StudentSortField;
  }
  const sortDirection = optional(value.sortDirection)?.toUpperCase();
  if (sortDirection) {
    if (!["ASC", "DESC"].includes(sortDirection))
      throw new ValidationError([{ field: "sortDirection", message: "sortDirection is invalid" }]);
    result.sortDirection = sortDirection as SortDirection;
  }
  return result;
}
