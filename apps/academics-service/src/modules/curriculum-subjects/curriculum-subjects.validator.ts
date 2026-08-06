import { ValidationError } from "@school-erp/errors";
import type { CurriculumSubjectCategory, CurriculumSubjectCreateInput, CurriculumSubjectFilter, CurriculumSubjectUpdateInput } from "./curriculum-subjects.model";

const categories: CurriculumSubjectCategory[] = ["CORE", "LANGUAGE", "ELECTIVE", "OPTIONAL", "ACTIVITY"];
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const required = (input: Record<string, unknown>, field: string) => {
  const value = text(input[field]);
  if (!value) throw new ValidationError([{ field, message: `${field} is required` }]);
  return value;
};
const category = (value: unknown) => {
  const normalized = text(value)?.toUpperCase() as CurriculumSubjectCategory | undefined;
  if (!normalized || !categories.includes(normalized)) throw new ValidationError([{ field: "subjectCategory", message: "valid subjectCategory is required" }]);
  return normalized;
};
const optionalCredits = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const credits = Number(value);
  if (!Number.isFinite(credits) || credits < 0) throw new ValidationError([{ field: "credits", message: "credits must be zero or greater" }]);
  return credits;
};

export function validateCurriculumSubjectCreate(value: unknown): CurriculumSubjectCreateInput {
  const input = object(value);
  const localSubjectCode = text(input.localSubjectCode), gradingSchemeId = text(input.gradingSchemeId), examinationSchemeId = text(input.examinationSchemeId), credits = optionalCredits(input.credits);
  return {
    academicUnitId: required(input, "academicUnitId"), curriculumId: required(input, "curriculumId"),
    programId: required(input, "programId"), academicLevelId: required(input, "academicLevelId"),
    subjectCatalogueId: required(input, "subjectCatalogueId"), subjectCategory: category(input.subjectCategory),
    isMandatory: input.isMandatory === undefined ? true : input.isMandatory === true,
    ...(localSubjectCode ? { localSubjectCode } : {}), ...(gradingSchemeId ? { gradingSchemeId } : {}),
    ...(examinationSchemeId ? { examinationSchemeId } : {}), ...(credits !== undefined ? { credits } : {}),
  };
}
export function validateCurriculumSubjectUpdate(value: unknown): CurriculumSubjectUpdateInput {
  const input = object(value), expectedVersion = Number(input.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ValidationError([{ field: "expectedVersion", message: "valid expectedVersion is required" }]);
  const localSubjectCode = text(input.localSubjectCode), gradingSchemeId = text(input.gradingSchemeId), examinationSchemeId = text(input.examinationSchemeId), credits = optionalCredits(input.credits);
  return {
    expectedVersion, ...(input.subjectCategory !== undefined ? { subjectCategory: category(input.subjectCategory) } : {}),
    ...(input.isMandatory !== undefined ? { isMandatory: input.isMandatory === true } : {}),
    ...(localSubjectCode ? { localSubjectCode } : {}), ...(gradingSchemeId ? { gradingSchemeId } : {}),
    ...(examinationSchemeId ? { examinationSchemeId } : {}), ...(credits !== undefined ? { credits } : {}),
  };
}
export function validateCurriculumSubjectFilter(value: unknown): CurriculumSubjectFilter {
  const input = object(value), result: CurriculumSubjectFilter = {};
  for (const field of ["academicUnitId", "curriculumId", "programId", "academicLevelId", "subjectCatalogueId"] as const) {
    const value = text(input[field]); if (value) result[field] = value;
  }
  if (input.subjectCategory !== undefined) result.subjectCategory = category(input.subjectCategory);
  if (input.status === "ACTIVE" || input.status === "INACTIVE") result.status = input.status;
  return result;
}
