import { BadRequestError } from "@school-erp/errors";
import type { SubjectCreateInput, SubjectListFilter, SubjectStatus, SubjectType, SubjectUpdateInput } from "./subjects.model";

const allowedStatuses: SubjectStatus[] = ["ACTIVE", "INACTIVE"];
const allowedTypes: SubjectType[] = ["THEORY", "PRACTICAL", "MIXED"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new BadRequestError("credits must be a number");
  return number;
}

export function validateSubjectCreateInput(input: unknown): SubjectCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("subject input is required");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  const programId = asString(value.programId);
  const classId = asString(value.classId);
  const name = asString(value.name);
  const subjectType = asString(value.subjectType).toUpperCase() as SubjectType;
  const credits = asNumber(value.credits);
  if (!campusId) throw new BadRequestError("campusId is required");
  if (!programId) throw new BadRequestError("programId is required");
  if (!name) throw new BadRequestError("name is required");
  if (!allowedTypes.includes(subjectType)) throw new BadRequestError("subjectType is invalid");
  return {
    campusId,
    programId,
    classId: classId || undefined,
    name,
    subjectType,
    credits,
  };
}

export function validateSubjectUpdateInput(input: unknown): SubjectUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("subject update input is required");
  }
  const value = input as Record<string, unknown>;
  const update: SubjectUpdateInput = {};
  if (value.programId !== undefined) {
    const programId = asString(value.programId);
    if (!programId) throw new BadRequestError("programId cannot be empty");
    update.programId = programId;
  }
  if (value.classId !== undefined) {
    const classId = asString(value.classId);
    update.classId = classId || undefined;
  }
  if (value.name !== undefined) {
    const name = asString(value.name);
    if (!name) throw new BadRequestError("name cannot be empty");
    update.name = name;
  }
  if (value.subjectType !== undefined) {
    const subjectType = asString(value.subjectType).toUpperCase() as SubjectType;
    if (!allowedTypes.includes(subjectType)) throw new BadRequestError("subjectType is invalid");
    update.subjectType = subjectType;
  }
  if (value.credits !== undefined) {
    update.credits = asNumber(value.credits);
  }
  if (value.status !== undefined) {
    const status = asString(value.status).toUpperCase();
    if (!allowedStatuses.includes(status as SubjectStatus)) {
      throw new BadRequestError("status is invalid");
    }
    update.status = status as SubjectStatus;
  }
  return update;
}

export function validateSubjectListFilter(input: unknown): SubjectListFilter {
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("subject filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const campusId = asString(value.campusId);
  if (!campusId) throw new BadRequestError("campusId is required");
  const filter: SubjectListFilter = { campusId };
  const programId = asString(value.programId);
  const classId = asString(value.classId);
  if (programId) filter.programId = programId;
  if (classId) filter.classId = classId;
  const status = asString(value.status).toUpperCase();
  if (status) {
    if (!allowedStatuses.includes(status as SubjectStatus)) {
      throw new BadRequestError("status is invalid");
    }
    filter.status = status as SubjectStatus;
  }
  return filter;
}
