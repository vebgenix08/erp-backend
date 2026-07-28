import { BadRequestError } from "@school-erp/errors";
import type { ClassCreateInput, ClassListFilter, ClassStatus, ClassUpdateInput } from "./classes.model";

const allowedStatuses: ClassStatus[] = ["ACTIVE", "INACTIVE"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateClassCreateInput(input: unknown): ClassCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("class input is required");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  const programId = asString(value.programId);
  const name = asString(value.name);
  const description = asString(value.description);
  if (!campusId) throw new BadRequestError("campusId is required");
  if (!programId) throw new BadRequestError("programId is required");
  if (!name) throw new BadRequestError("name is required");
  return {
    campusId,
    programId,
    name,
    description: description || undefined,
  };
}

export function validateClassUpdateInput(input: unknown): ClassUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("class update input is required");
  }
  const value = input as Record<string, unknown>;
  const update: ClassUpdateInput = {};
  if (value.programId !== undefined) {
    const programId = asString(value.programId);
    if (!programId) throw new BadRequestError("programId cannot be empty");
    update.programId = programId;
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
    if (!allowedStatuses.includes(status as ClassStatus)) {
      throw new BadRequestError("status is invalid");
    }
    update.status = status as ClassStatus;
  }
  return update;
}

export function validateClassListFilter(input: unknown): ClassListFilter {
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("class filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  if (!campusId) throw new BadRequestError("campusId is required");
  const filter: ClassListFilter = { campusId };
  const programId = asString(value.programId);
  if (programId) filter.programId = programId;
  const status = asString(value.status).toUpperCase();
  if (status) {
    if (!allowedStatuses.includes(status as ClassStatus)) {
      throw new BadRequestError("status is invalid");
    }
    filter.status = status as ClassStatus;
  }
  return filter;
}
