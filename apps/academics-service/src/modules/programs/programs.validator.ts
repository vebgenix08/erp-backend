import { BadRequestError } from "@school-erp/errors";
import type { ProgramCreateInput, ProgramListFilter, ProgramStatus, ProgramUpdateInput } from "./programs.model";

const allowedStatuses: ProgramStatus[] = ["ACTIVE", "INACTIVE"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateProgramCreateInput(input: unknown): ProgramCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("program input is required");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  const academicUnitId = asString(value.academicUnitId);
  const name = asString(value.name);
  const description = asString(value.description);
  if (!campusId) throw new BadRequestError("campusId is required");
  if (!academicUnitId) throw new BadRequestError("academicUnitId is required");
  if (!name) throw new BadRequestError("name is required");
  return {
    campusId,
    academicUnitId,
    name,
    description: description || undefined,
  };
}

export function validateProgramUpdateInput(input: unknown): ProgramUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("program update input is required");
  }
  const value = input as Record<string, unknown>;
  const update: ProgramUpdateInput = {};
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
    if (!allowedStatuses.includes(status as ProgramStatus)) {
      throw new BadRequestError("status is invalid");
    }
    update.status = status as ProgramStatus;
  }
  return update;
}

export function validateProgramListFilter(input: unknown): ProgramListFilter {
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("program filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  if (!campusId) throw new BadRequestError("campusId is required");
  const filter: ProgramListFilter = { campusId };
  const academicUnitId = asString(value.academicUnitId);
  if (academicUnitId) filter.academicUnitId = academicUnitId;
  const status = asString(value.status).toUpperCase();
  if (status) {
    if (!allowedStatuses.includes(status as ProgramStatus)) {
      throw new BadRequestError("status is invalid");
    }
    filter.status = status as ProgramStatus;
  }
  return filter;
}
