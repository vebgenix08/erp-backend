import { BadRequestError } from "@school-erp/errors";
import type { AcademicUnitStatus, AcademicUnitType, CampusAcademicUnitCreateInput, CampusAcademicUnitListFilter, CampusAcademicUnitUpdateInput } from "./campus-academic-units.model";

const types: AcademicUnitType[] = ["SCHOOL", "PU", "DEGREE"];
const statuses: AcademicUnitStatus[] = ["ACTIVE", "INACTIVE"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const unitType = (value: unknown) => {
  const result = text(value).toUpperCase() as AcademicUnitType;
  if (!types.includes(result)) throw new BadRequestError("academic unit type is invalid");
  return result;
};
export function validateAcademicUnitCreateInput(input: unknown): CampusAcademicUnitCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("academic unit input is required");
  const value = input as Record<string, unknown>;
  const name = text(value.name); const curriculumOrAffiliationId = text(value.curriculumOrAffiliationId);
  if (!name) throw new BadRequestError("academic unit name is required");
  if (!curriculumOrAffiliationId) throw new BadRequestError("curriculum or affiliation is required");
  return { name, type: unitType(value.type), curriculumOrAffiliationId };
}
export function validateAcademicUnitUpdateInput(input: unknown): CampusAcademicUnitUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("academic unit update input is required");
  const value = input as Record<string, unknown>; const result: CampusAcademicUnitUpdateInput = {};
  if (value.name !== undefined) { result.name = text(value.name); if (!result.name) throw new BadRequestError("academic unit name cannot be empty"); }
  if (value.curriculumOrAffiliationId !== undefined) {
    result.curriculumOrAffiliationId = text(value.curriculumOrAffiliationId);
    if (!result.curriculumOrAffiliationId) throw new BadRequestError("curriculum or affiliation cannot be empty");
  }
  if (value.status !== undefined) {
    const status = text(value.status).toUpperCase() as AcademicUnitStatus;
    if (!statuses.includes(status)) throw new BadRequestError("academic unit status is invalid");
    result.status = status;
  }
  return result;
}
export function validateAcademicUnitListFilter(input: unknown): CampusAcademicUnitListFilter {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("academic unit filter must be an object");
  const value = input as Record<string, unknown>; const result: CampusAcademicUnitListFilter = {};
  if (text(value.campusId)) result.campusId = text(value.campusId);
  if (value.type !== undefined) result.type = unitType(value.type);
  if (value.status !== undefined) {
    const status = text(value.status).toUpperCase() as AcademicUnitStatus;
    if (!statuses.includes(status)) throw new BadRequestError("academic unit status is invalid");
    result.status = status;
  }
  return result;
}
