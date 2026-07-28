import { BadRequestError } from "@school-erp/errors";
import { isNonEmptyString } from "@school-erp/validation";
import type { CampusCreateInput, CampusListFilter, CampusUpdateInput } from "./campuses.model";
import type { CampusStatus, CampusType } from "./campuses.model";

const CAMPUS_TYPES: CampusType[] = ["SCHOOL", "COLLEGE", "DEGREE_COLLEGE"];
const CAMPUS_STATUS: CampusStatus[] = ["ACTIVE", "INACTIVE"];

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateCampusCreateInput(input: unknown): CampusCreateInput {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("campus payload is required");
  }
  const payload = input as Record<string, unknown>;
  const name = normalizeOptional(payload.name);
  const campusType = normalizeOptional(payload.campusType) as CampusType | undefined;
  if (!isNonEmptyString(name ?? "")) throw new BadRequestError("campus name is required");
  if (!campusType || !CAMPUS_TYPES.includes(campusType)) {
    throw new BadRequestError("campus type is required");
  }
  return {
    name: name as string,
    campusType,
    ...(normalizeOptional(payload.address) !== undefined ? { address: normalizeOptional(payload.address) } : {}),
    ...(normalizeOptional(payload.contactEmail) !== undefined ? { contactEmail: normalizeOptional(payload.contactEmail) } : {}),
    ...(normalizeOptional(payload.contactPhone) !== undefined ? { contactPhone: normalizeOptional(payload.contactPhone) } : {}),
  };
}

export function validateCampusUpdateInput(input: unknown): CampusUpdateInput {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("campus payload is required");
  }
  const payload = input as Record<string, unknown>;
  const result: CampusUpdateInput = {};
  const name = normalizeOptional(payload.name);
  const campusType = normalizeOptional(payload.campusType) as CampusType | undefined;
  const status = normalizeOptional(payload.status) as CampusStatus | undefined;
  if (name !== undefined) result.name = name;
  if (campusType !== undefined) {
    if (!CAMPUS_TYPES.includes(campusType)) throw new BadRequestError("campus type is required");
    result.campusType = campusType;
  }
  if (status !== undefined) {
    if (!CAMPUS_STATUS.includes(status)) throw new BadRequestError("campus status is invalid");
    result.status = status;
  }
  const address = normalizeOptional(payload.address);
  if (address !== undefined) result.address = address;
  const contactEmail = normalizeOptional(payload.contactEmail);
  if (contactEmail !== undefined) result.contactEmail = contactEmail;
  const contactPhone = normalizeOptional(payload.contactPhone);
  if (contactPhone !== undefined) result.contactPhone = contactPhone;
  return result;
}

export function validateCampusListFilter(input?: unknown): CampusListFilter {
  if (!input || typeof input !== "object") return {};
  const payload = input as Record<string, unknown>;
  const status = normalizeOptional(payload.status) as CampusStatus | undefined;
  if (status !== undefined && !CAMPUS_STATUS.includes(status)) {
    throw new BadRequestError("campus status is invalid");
  }
  const campusType = normalizeOptional(payload.campusType) as CampusType | undefined;
  if (campusType && !CAMPUS_TYPES.includes(campusType)) throw new BadRequestError("campus type is invalid");
  const search = normalizeOptional(payload.search);
  return { ...(status ? { status } : {}), ...(campusType ? { campusType } : {}), ...(search ? { search } : {}) };
}
