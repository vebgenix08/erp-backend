import { BadRequestError } from "@school-erp/errors";
import type { AcademicOfferingCreateInput, AcademicOfferingListFilter, AcademicOfferingStatus, AcademicOfferingUpdateInput } from "./academic-offerings.model";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const identifier = (value: unknown, field: string) => {
  const result = text(value);
  if (!result) throw new BadRequestError(`${field} is required`);
  return result;
};
const capacity = (value: unknown) => {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new BadRequestError("capacity must be a positive whole number");
  return value;
};
export function validateAcademicOfferingCreateInput(input: unknown): AcademicOfferingCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("academic offering input is required");
  const value = input as Record<string, unknown>;
  const result: AcademicOfferingCreateInput = {
    campusId: identifier(value.campusId, "campusId"),
    academicYearId: identifier(value.academicYearId, "academicYearId"),
    curriculumId: identifier(value.curriculumId, "curriculumId"),
    programId: identifier(value.programId, "programId"),
    classId: identifier(value.classId, "classId"),
  };
  if (value.sectionId !== undefined && text(value.sectionId)) result.sectionId = text(value.sectionId);
  if (value.medium !== undefined && text(value.medium)) result.medium = text(value.medium);
  if (value.capacity !== undefined) result.capacity = capacity(value.capacity);
  return result;
}
export function validateAcademicOfferingUpdateInput(input: unknown): AcademicOfferingUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("academic offering update input is required");
  const value = input as Record<string, unknown>; const result: AcademicOfferingUpdateInput = {};
  if (value.sectionId !== undefined) result.sectionId = text(value.sectionId) || undefined;
  if (value.medium !== undefined) result.medium = text(value.medium) || undefined;
  if (value.capacity !== undefined) result.capacity = capacity(value.capacity);
  if (value.status !== undefined) {
    const status = text(value.status).toUpperCase() as AcademicOfferingStatus;
    if (!["ACTIVE", "INACTIVE"].includes(status)) throw new BadRequestError("academic offering status is invalid");
    result.status = status;
  }
  return result;
}
export function validateAcademicOfferingListFilter(input: unknown): AcademicOfferingListFilter {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("academic offering filter must be an object");
  const value = input as Record<string, unknown>; const result: AcademicOfferingListFilter = {};
  for (const field of ["campusId", "academicYearId", "curriculumId", "programId", "classId"] as const) {
    if (text(value[field])) result[field] = text(value[field]);
  }
  if (value.status !== undefined) {
    const status = text(value.status).toUpperCase() as AcademicOfferingStatus;
    if (!["ACTIVE", "INACTIVE"].includes(status)) throw new BadRequestError("academic offering status is invalid");
    result.status = status;
  }
  return result;
}
