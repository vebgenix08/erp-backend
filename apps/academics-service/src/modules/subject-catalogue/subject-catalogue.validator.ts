import { ValidationError } from "@school-erp/errors";
import type { SubjectCatalogueCreateInput, SubjectCatalogueFilter, SubjectCatalogueUpdateInput } from "./subject-catalogue.model";

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function validateSubjectCatalogueCreate(value: unknown): SubjectCatalogueCreateInput {
  const input = object(value);
  const name = text(input.name);
  const shortName = text(input.shortName), description = text(input.description), departmentId = text(input.departmentId), subjectDomain = text(input.subjectDomain);
  if (!name) throw new ValidationError([{ field: "name", message: "subject name is required" }]);
  return {
    name,
    ...(shortName ? { shortName } : {}),
    ...(description ? { description } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(subjectDomain ? { subjectDomain: subjectDomain.toUpperCase() } : {}),
  };
}

export function validateSubjectCatalogueUpdate(value: unknown): SubjectCatalogueUpdateInput {
  const input = object(value);
  const expectedVersion = Number(input.expectedVersion);
  const name = text(input.name), shortName = text(input.shortName), description = text(input.description), departmentId = text(input.departmentId), subjectDomain = text(input.subjectDomain);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new ValidationError([{ field: "expectedVersion", message: "valid expectedVersion is required" }]);
  return {
    expectedVersion,
    ...(name ? { name } : {}),
    ...(shortName ? { shortName } : {}),
    ...(description ? { description } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(subjectDomain ? { subjectDomain: subjectDomain.toUpperCase() } : {}),
  };
}

export function validateSubjectCatalogueFilter(value: unknown): SubjectCatalogueFilter {
  const input = object(value);
  const status = text(input.status);
  const search = text(input.search), departmentId = text(input.departmentId), subjectDomain = text(input.subjectDomain);
  return {
    ...(search ? { search } : {}),
    ...(status === "ACTIVE" || status === "INACTIVE" ? { status } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(subjectDomain ? { subjectDomain: subjectDomain.toUpperCase() } : {}),
  };
}
