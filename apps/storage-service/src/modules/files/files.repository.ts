import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { FileCreateUploadInput, FileListFilter, FileRecord, FileStatus } from "./files.model";

export interface FileRepository {
  list(tenantId: string, filter?: FileListFilter): Promise<FileRecord[]>;
  getById(tenantId: string, id: string): Promise<FileRecord | null>;
  getByStorageKey(tenantId: string, storageKey: string): Promise<FileRecord | null>;
  create(input: FileRecord): Promise<FileRecord>;
  update(tenantId: string, id: string, input: Partial<FileRecord>): Promise<FileRecord | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

interface FileDocument extends FileRecord {
  _id: string;
}

function now() {
  return new Date();
}

function clone(record: FileRecord): FileRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    uploadedAt: record.uploadedAt ? new Date(record.uploadedAt) : undefined,
    deletedAt: record.deletedAt ? new Date(record.deletedAt) : undefined,
  };
}

function toDocument(record: FileRecord): FileDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: FileDocument | null): FileRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `file_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(record: FileRecord, search: string): boolean {
  const query = normalizeSearch(search);
  return (
    record.fileName.toLowerCase().includes(query) ||
    record.contentType.toLowerCase().includes(query) ||
    record.storageKey.toLowerCase().includes(query) ||
    record.scopeType.toLowerCase().includes(query)
  );
}

function createRecord(input: FileCreateUploadInput & { tenantId: string }, storageKey: string, bucket: string, createdBy: string): FileRecord {
  const timestamp = now();
  return {
    id: makeId(),
    tenantId: input.tenantId,
    scopeType: input.scopeType ?? "TENANT",
    scopeId: input.scopeId,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    metadata: input.metadata ? { ...input.metadata } : undefined,
    storageKey,
    bucket,
    status: "PENDING_UPLOAD",
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class InMemoryFileRepository implements FileRepository {
  private readonly records = new Map<string, Map<string, FileRecord>>();

  private bucket(tenantId: string): Map<string, FileRecord> {
    let bucket = this.records.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, FileRecord>();
      this.records.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter: FileListFilter = {}) {
    return [...this.bucket(normalizeTenantId(tenantId)).values()]
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.scopeType && record.scopeType !== filter.scopeType) return false;
        if (filter.scopeId && record.scopeId !== filter.scopeId) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    const record = this.bucket(normalizeTenantId(tenantId)).get(id) ?? null;
    return record ? clone(record) : null;
  }

  async getByStorageKey(tenantId: string, storageKey: string) {
    const record = [...this.bucket(normalizeTenantId(tenantId)).values()].find((item) => item.storageKey === storageKey) ?? null;
    return record ? clone(record) : null;
  }

  async create(input: FileRecord) {
    const duplicate = await this.getByStorageKey(input.tenantId, input.storageKey);
    if (duplicate) {
      throw new ConflictError("storage key must be unique per tenant");
    }
    const record = clone(input);
    this.bucket(normalizeTenantId(input.tenantId)).set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: Partial<FileRecord>) {
    const bucket = this.bucket(normalizeTenantId(tenantId));
    const existing = bucket.get(id);
    if (!existing) return null;
    const updated = clone({
      ...existing,
      ...input,
      tenantId: normalizeTenantId(tenantId),
      updatedAt: now(),
    });
    bucket.set(id, updated);
    return clone(updated);
  }

  async delete(tenantId: string, id: string) {
    const bucket = this.bucket(normalizeTenantId(tenantId));
    return bucket.delete(id);
  }
}

export class MongoFileRepository implements FileRepository {
  constructor(private readonly collection: CollectionAdapter<FileDocument>) {}

  async list(tenantId: string, filter: FileListFilter = {}) {
    const records = await this.collection.findMany({ tenantId: normalizeTenantId(tenantId) });
    return records
      .map((record) => fromDocument(record))
      .filter((record): record is FileRecord => record !== null)
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.scopeType && record.scopeType !== filter.scopeType) return false;
        if (filter.scopeId && record.scopeId !== filter.scopeId) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async getById(tenantId: string, id: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByStorageKey(tenantId: string, storageKey: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), storageKey }));
  }

  async create(input: FileRecord) {
    const duplicate = await this.getByStorageKey(input.tenantId, input.storageKey);
    if (duplicate) {
      throw new ConflictError("storage key must be unique per tenant");
    }
    await this.collection.insertOne(toDocument(input));
    return clone(input);
  }

  async update(tenantId: string, id: string, input: Partial<FileRecord>) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    const updated = clone({
      ...existing,
      ...input,
      tenantId: normalizeTenantId(tenantId),
      updatedAt: now(),
    });
    const replaced = await this.collection.replaceOne({ tenantId: normalizeTenantId(tenantId), _id: id }, toDocument(updated));
    return replaced ? updated : null;
  }

  async delete(tenantId: string, id: string) {
    return this.collection.deleteOne({ tenantId: normalizeTenantId(tenantId), _id: id });
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createFileRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<FileRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryFileRepository();
  }
  const collection = await getCollection<FileDocument>("storage_files", env);
  await collection.createIndex({ tenantId: 1, storageKey: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, status: 1 });
  return new MongoFileRepository(createMongoCollectionAdapter(collection));
}

let singleton: Promise<FileRepository> | undefined;
export function fileRepository() {
  singleton ??= createFileRepository();
  return singleton;
}

export { createRecord };
