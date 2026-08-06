import { BadRequestError } from "@school-erp/errors";
import { validateAcademicUnitCreateInput } from "../campus-academic-units/campus-academic-units.validator";
import { validateCampusCreateInput } from "../campuses/campuses.validator";
import type { CampusSetupCreateInput } from "./campus-setup.model";

export function validateCampusSetupCreateInput(input: unknown): CampusSetupCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("campus setup input is required");
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.academicUnits) || value.academicUnits.length === 0) {
    throw new BadRequestError("at least one academic unit is required");
  }
  const academicUnits = value.academicUnits.map(validateAcademicUnitCreateInput);
  const keys = academicUnits.map((unit) => `${unit.type}:${unit.curriculumOrAffiliationId}`.toLowerCase());
  if (new Set(keys).size !== keys.length) throw new BadRequestError("duplicate academic units are not allowed");
  return { ...validateCampusCreateInput(value), academicUnits };
}
