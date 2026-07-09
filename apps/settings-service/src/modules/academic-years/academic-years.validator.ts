import { BadRequestError } from "@school-erp/errors";
import { isNonEmptyString } from "@school-erp/validation";
import type { AcademicYearCreateInput, AcademicYearListFilter, AcademicYearUpdateInput } from "./academic-years.model";
import type { AcademicYearStatus } from "./academic-years.model";

const STATUS: AcademicYearStatus[] = ["ACTIVE", "INACTIVE"];

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDate(value: unknown, label: string): string {
  const raw = normalizeOptional(value);
  if (!raw) throw new BadRequestError(`${label} is required`);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${label} is invalid`);
  }
  return parsed.toISOString().slice(0, 10);
}

export function validateAcademicYearCreateInput(input: unknown): AcademicYearCreateInput {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("academic year payload is required");
  }
  const payload = input as Record<string, unknown>;
  const code = normalizeOptional(payload.code);
  const name = normalizeOptional(payload.name);
  if (!isNonEmptyString(code ?? "")) throw new BadRequestError("academic year code is required");
  if (!isNonEmptyString(name ?? "")) throw new BadRequestError("academic year name is required");
  const startDate = normalizeDate(payload.startDate, "start date");
  const endDate = normalizeDate(payload.endDate, "end date");
  if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
    throw new BadRequestError("end date must be after start date");
  }
  return { code: code as string, name: name as string, startDate, endDate };
}

export function validateAcademicYearUpdateInput(input: unknown): AcademicYearUpdateInput {
  if (!input || typeof input !== "object") {
    throw new BadRequestError("academic year payload is required");
  }
  const payload = input as Record<string, unknown>;
  const result: AcademicYearUpdateInput = {};
  const code = normalizeOptional(payload.code);
  const name = normalizeOptional(payload.name);
  if (code !== undefined) result.code = code;
  if (name !== undefined) result.name = name;
  if (payload.startDate !== undefined) result.startDate = normalizeDate(payload.startDate, "start date");
  if (payload.endDate !== undefined) result.endDate = normalizeDate(payload.endDate, "end date");
  if (result.startDate && result.endDate && new Date(result.startDate).getTime() >= new Date(result.endDate).getTime()) {
    throw new BadRequestError("end date must be after start date");
  }
  return result;
}

export function validateAcademicYearListFilter(input?: unknown): AcademicYearListFilter {
  if (!input || typeof input !== "object") return {};
  const payload = input as Record<string, unknown>;
  const status = normalizeOptional(payload.status) as AcademicYearStatus | undefined;
  if (status !== undefined && !STATUS.includes(status)) {
    throw new BadRequestError("academic year status is invalid");
  }
  return status !== undefined ? { status } : {};
}
