import type { RequestContext } from "@school-erp/api";
import { BadRequestError } from "@school-erp/errors";
import { filePermissions } from "./files.permissions";
import { toFileView } from "./files.mapper";
import type { FileRepository } from "./files.repository";
import { fileRepository as defaultRepository } from "./files.repository";
import { validateFileCreateUploadInput, validateFileDownloadUrlInput, validateFileListFilter } from "./files.validator";
import type {
  FileCreateUploadInput,
  FileDownloadUrlResponse,
  FileListFilter,
  FileRecord,
  FileServiceContext,
  FileUploadUrlResponse,
  FileView,
} from "./files.model";

export interface StorageUrlPort {
  createUploadUrl(input: { bucket: string; storageKey: string; contentType: string; expiresInSeconds: number }): Promise<{ url: string; expiresAt: Date; headers?: Record<string, string> }>;
  createDownloadUrl(input: { bucket: string; storageKey: string; expiresInSeconds: number }): Promise<{ url: string; expiresAt: Date }>;
}

export class InMemoryStorageUrlPort implements StorageUrlPort {
  async createUploadUrl(input: { bucket: string; storageKey: string; contentType: string; expiresInSeconds: number }) {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      url: `https://storage.local/upload/${encodeURIComponent(input.bucket)}/${encodeURIComponent(input.storageKey)}`,
      expiresAt,
      headers: { "content-type": input.contentType },
    };
  }

  async createDownloadUrl(input: { bucket: string; storageKey: string; expiresInSeconds: number }) {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      url: `https://storage.local/download/${encodeURIComponent(input.bucket)}/${encodeURIComponent(input.storageKey)}`,
      expiresAt,
    };
  }
}

export interface StorageServiceDeps {
  repository?: FileRepository | Promise<FileRepository>;
  urlPort?: StorageUrlPort | undefined;
  bucketPrefix?: string | undefined;
  documentsBucketName?: string | undefined;
  defaultUploadExpiresInSeconds?: number | undefined;
}

function resolveRepository(deps?: StorageServiceDeps): FileRepository | Promise<FileRepository> {
  return deps?.repository ?? defaultRepository();
}

const localUrlPort = new InMemoryStorageUrlPort();

function resolveUrlPort(deps?: StorageServiceDeps): StorageUrlPort {
  return deps?.urlPort ?? localUrlPort;
}

function getTenantId(context: RequestContext | FileServiceContext): string {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) {
    throw new BadRequestError("tenantId is required");
  }
  return tenantId;
}

function getActorId(context: RequestContext | FileServiceContext): string {
  const userId = context.authContext?.user?.id?.trim();
  if (!userId) {
    throw new BadRequestError("authenticated user is required");
  }
  return userId;
}

function assertPermission(context: RequestContext | FileServiceContext, permission: string): void {
  const permissions = (context.authContext?.user?.permissions ?? []) as string[];
  if (!permissions.includes(permission)) {
    throw new BadRequestError("permission denied");
  }
}

function bucketName(tenantId: string, deps?: StorageServiceDeps): string {
  const configured = deps?.documentsBucketName?.trim() || runtimeEnv().DOCUMENTS_BUCKET_NAME?.trim();
  if (configured) return configured;
  return `${deps?.bucketPrefix?.trim() || "documents"}-${tenantId}`;
}

function newId(): string {
  return `file_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function storageKey(tenantId: string, input: FileCreateUploadInput): string {
  const normalizedName = input.fileName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const scope = input.scopeType?.toLowerCase() ?? "tenant";
  const scopeId = input.scopeId?.trim() || tenantId;
  return `${tenantId}/${scope}/${scopeId}/${crypto.randomUUID()}-${normalizedName}`;
}

function runtimeEnv(): Record<string, string | undefined> {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function ensureAvailable(record: FileRecord): void {
  if (record.status === "DELETED") {
    throw new BadRequestError("file has been deleted");
  }
}

export async function createFileUploadUrl(
  input: unknown,
  context: RequestContext | FileServiceContext,
  deps?: StorageServiceDeps,
): Promise<FileUploadUrlResponse> {
  assertPermission(context, filePermissions.create);
  const repository = await resolveRepository(deps);
  const payload = validateFileCreateUploadInput(input);
  const tenantId = getTenantId(context);
  const record = await repository.create({
    id: newId(),
    tenantId,
    scopeType: payload.scopeType ?? "TENANT",
    scopeId: payload.scopeId,
    fileName: payload.fileName,
    contentType: payload.contentType,
    sizeBytes: payload.sizeBytes,
    metadata: payload.metadata ? { ...payload.metadata } : undefined,
    storageKey: storageKey(tenantId, payload),
    bucket: bucketName(tenantId, deps),
    status: "PENDING_UPLOAD",
    createdBy: getActorId(context),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const upload = await resolveUrlPort(deps).createUploadUrl({
    bucket: record.bucket,
    storageKey: record.storageKey,
    contentType: record.contentType,
    expiresInSeconds: deps?.defaultUploadExpiresInSeconds ?? 900,
  });
  return {
    file: toFileView(record) as FileView,
    uploadUrl: upload.url,
    expiresAt: upload.expiresAt.toISOString(),
    headers: upload.headers,
  };
}

export async function completeFileUpload(
  id: string,
  context: RequestContext | FileServiceContext,
  deps?: StorageServiceDeps,
): Promise<FileView | null> {
  assertPermission(context, filePermissions.update);
  const repository = await resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) return null;
  ensureAvailable(existing);
  const updated = await repository.update(tenantId, id, {
    status: "AVAILABLE",
    uploadedAt: new Date(),
  });
  return toFileView(updated);
}

export async function getFile(id: string, context: RequestContext | FileServiceContext, deps?: StorageServiceDeps): Promise<FileView | null> {
  assertPermission(context, filePermissions.read);
  const repository = await resolveRepository(deps);
  return toFileView(await repository.getById(getTenantId(context), id));
}

export async function listFiles(
  context: RequestContext | FileServiceContext,
  deps?: StorageServiceDeps,
  filter?: unknown,
): Promise<FileView[]> {
  assertPermission(context, filePermissions.read);
  const repository = await resolveRepository(deps);
  return (await repository.list(getTenantId(context), validateFileListFilter(filter))).map((record) => toFileView(record) as FileView);
}

export async function createFileDownloadUrl(
  id: string,
  input: unknown,
  context: RequestContext | FileServiceContext,
  deps?: StorageServiceDeps,
): Promise<FileDownloadUrlResponse | null> {
  assertPermission(context, filePermissions.read);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(getTenantId(context), id);
  if (!existing) return null;
  ensureAvailable(existing);
  const payload = validateFileDownloadUrlInput(input);
  const download = await resolveUrlPort(deps).createDownloadUrl({
    bucket: existing.bucket,
    storageKey: existing.storageKey,
    expiresInSeconds: payload.expiresInSeconds ?? 900,
  });
  return {
    file: toFileView(existing) as FileView,
    downloadUrl: download.url,
    expiresAt: download.expiresAt.toISOString(),
  };
}

export async function deleteFile(id: string, context: RequestContext | FileServiceContext, deps?: StorageServiceDeps): Promise<boolean> {
  assertPermission(context, filePermissions.delete);
  const repository = await resolveRepository(deps);
  const existing = await repository.getById(getTenantId(context), id);
  if (!existing) return false;
  const updated = await repository.update(getTenantId(context), id, {
    status: "DELETED",
    deletedAt: new Date(),
  });
  return Boolean(updated);
}
