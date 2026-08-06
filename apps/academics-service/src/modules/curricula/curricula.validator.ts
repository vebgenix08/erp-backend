import { BadRequestError } from "@school-erp/errors";
import type {
  CurriculumCreateInput,
  CurriculumListFilter,
  CurriculumStatus,
  CurriculumType,
  CurriculumUpdateInput,
} from "./curricula.model";

const types: CurriculumType[] = ["STATE_BOARD", "CBSE", "ICSE", "PU_BOARD", "UNIVERSITY", "AUTONOMOUS", "OTHER"];
const statuses: CurriculumStatus[] = ["ACTIVE", "INACTIVE"];
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function curriculumType(value: unknown): CurriculumType {
  const normalized = text(value).toUpperCase() as CurriculumType;
  if (!types.includes(normalized)) throw new BadRequestError("curriculum type is invalid");
  return normalized;
}

export function validateCurriculumCreateInput(input: unknown): CurriculumCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("curriculum input is required");
  const value = input as Record<string, unknown>;
  const name = text(value.name);
  if (!name) throw new BadRequestError("curriculum name is required");
  return { name, type: curriculumType(value.type), authorityName: text(value.authorityName) || undefined };
}

export function validateCurriculumUpdateInput(input: unknown): CurriculumUpdateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("curriculum update input is required");
  const value = input as Record<string, unknown>;
  const update: CurriculumUpdateInput = {};
  if (value.name !== undefined) {
    update.name = text(value.name);
    if (!update.name) throw new BadRequestError("curriculum name cannot be empty");
  }
  if (value.type !== undefined) update.type = curriculumType(value.type);
  if (value.authorityName !== undefined) update.authorityName = text(value.authorityName) || undefined;
  if (value.status !== undefined) {
    const status = text(value.status).toUpperCase() as CurriculumStatus;
    if (!statuses.includes(status)) throw new BadRequestError("curriculum status is invalid");
    update.status = status;
  }
  return update;
}

export function validateCurriculumListFilter(input: unknown): CurriculumListFilter {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("curriculum filter must be an object");
  const value = input as Record<string, unknown>;
  const filter: CurriculumListFilter = {};
  if (value.type !== undefined) filter.type = curriculumType(value.type);
  if (value.status !== undefined) {
    const status = text(value.status).toUpperCase() as CurriculumStatus;
    if (!statuses.includes(status)) throw new BadRequestError("curriculum status is invalid");
    filter.status = status;
  }
  return filter;
}
