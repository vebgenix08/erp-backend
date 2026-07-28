import { BadRequestError } from "@school-erp/errors";
import type { SectionCreateInput, SectionListFilter, SectionStatus, SectionUpdateInput } from "./sections.model";

const allowedStatuses: SectionStatus[] = ["ACTIVE", "INACTIVE"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateSectionCreateInput(input: unknown): SectionCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("section input is required");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  const programId = asString(value.programId);
  const classId = asString(value.classId);
  const name = asString(value.name);
  const description = asString(value.description);
  if (!campusId) throw new BadRequestError("campusId is required");
  if (!programId) throw new BadRequestError("programId is required");
  if (!classId) throw new BadRequestError("classId is required");
  if (!name) throw new BadRequestError("name is required");
  return {
    campusId,
    programId,
    classId,
    name,
    description: description || undefined,
  };
}

export function validateSectionUpdateInput(input: unknown): SectionUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("section update input is required");
  }
  const value = input as Record<string, unknown>;
  const update: SectionUpdateInput = {};
  if (value.programId !== undefined) {
    const programId = asString(value.programId);
    if (!programId) throw new BadRequestError("programId cannot be empty");
    update.programId = programId;
  }
  if (value.classId !== undefined) {
    const classId = asString(value.classId);
    if (!classId) throw new BadRequestError("classId cannot be empty");
    update.classId = classId;
  }
  if (value.name !== undefined) {
    const name = asString(value.name);
    if (!name) throw new BadRequestError("name cannot be empty");
    update.name = name;
  }
  if (value.description !== undefined) {
    update.description = asString(value.description) || undefined;
  }
  if (value.status !== undefined) {
    const status = asString(value.status).toUpperCase();
    if (!allowedStatuses.includes(status as SectionStatus)) {
      throw new BadRequestError("status is invalid");
    }
    update.status = status as SectionStatus;
  }
  return update;
}

export function validateSectionListFilter(input: unknown): SectionListFilter {
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("section filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  if (!campusId) throw new BadRequestError("campusId is required");
  const filter: SectionListFilter = { campusId };
  const programId = asString(value.programId);
  const classId = asString(value.classId);
  if (programId) filter.programId = programId;
  if (classId) filter.classId = classId;
  const status = asString(value.status).toUpperCase();
  if (status) {
    if (!allowedStatuses.includes(status as SectionStatus)) {
      throw new BadRequestError("status is invalid");
    }
    filter.status = status as SectionStatus;
  }
  return filter;
}
