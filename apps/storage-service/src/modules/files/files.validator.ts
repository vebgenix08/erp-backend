import { BadRequestError } from "@school-erp/errors";
import type { FileCreateUploadInput, FileDownloadUrlInput, FileListFilter, FileScopeType, FileStatus } from "./files.model";

const allowedStatuses: FileStatus[] = ["PENDING_UPLOAD", "AVAILABLE", "DELETED"];
const allowedScopes: FileScopeType[] = ["TENANT", "CAMPUS", "ACADEMIC_YEAR", "CLASS", "SECTION", "STUDENT", "PUBLIC"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BadRequestError("sizeBytes must be a number");
  }
  return value;
}

function asMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("metadata must be an object");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 10) throw new BadRequestError("metadata supports at most 10 values");
  const metadata: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    const item = asString(rawValue);
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) {
      throw new BadRequestError("metadata key is invalid");
    }
    if (!item || item.length > 200) {
      throw new BadRequestError(`metadata value for ${key} is invalid`);
    }
    metadata[key] = item;
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

export function validateFileCreateUploadInput(input: unknown): FileCreateUploadInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("file upload input is required");
  }
  const value = input as Record<string, unknown>;
  const fileName = asString(value.fileName);
  const contentType = asString(value.contentType);
  const scopeType = asString(value.scopeType).toUpperCase() as FileScopeType;
  const scopeId = asString(value.scopeId);

  if (!fileName) throw new BadRequestError("fileName is required");
  if (!contentType) throw new BadRequestError("contentType is required");
  if (value.scopeType !== undefined && !allowedScopes.includes(scopeType)) throw new BadRequestError("scopeType is invalid");

  return {
    scopeType: value.scopeType !== undefined ? scopeType : "TENANT",
    scopeId: scopeId || undefined,
    fileName,
    contentType,
    sizeBytes: asNumber(value.sizeBytes),
    metadata: asMetadata(value.metadata),
  };
}

export function validateFileDownloadUrlInput(input: unknown): FileDownloadUrlInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const value = input as Record<string, unknown>;
  const expiresInSeconds = asNumber(value.expiresInSeconds);
  if (expiresInSeconds !== undefined && expiresInSeconds <= 0) {
    throw new BadRequestError("expiresInSeconds must be positive");
  }
  return { expiresInSeconds };
}

export function validateFileListFilter(input: unknown): FileListFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("file filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const filter: FileListFilter = {};
  const search = asString(value.search);
  const status = asString(value.status).toUpperCase();
  const scopeType = asString(value.scopeType).toUpperCase();
  const scopeId = asString(value.scopeId);
  if (search) filter.search = search;
  if (status) {
    if (!allowedStatuses.includes(status as FileStatus)) {
      throw new BadRequestError("status is invalid");
    }
    filter.status = status as FileStatus;
  }
  if (scopeType) {
    if (!allowedScopes.includes(scopeType as FileScopeType)) {
      throw new BadRequestError("scopeType is invalid");
    }
    filter.scopeType = scopeType as FileScopeType;
  }
  if (scopeId) filter.scopeId = scopeId;
  return filter;
}
