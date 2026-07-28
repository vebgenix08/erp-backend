import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { CognitoSyncCreateInput, CognitoSyncListFilter, CognitoSyncRecord, CognitoSyncUpdateInput } from "./cognito-sync.model";

export interface CognitoSyncRepository {
  list(tenantId: string, filter?: CognitoSyncListFilter): Promise<CognitoSyncRecord[]>;
  getById(tenantId: string, id: string): Promise<CognitoSyncRecord | null>;
  getByUserId(tenantId: string, userId: string): Promise<CognitoSyncRecord | null>;
  create(tenantId: string, input: CognitoSyncCreateInput): Promise<CognitoSyncRecord>;
  update(tenantId: string, id: string, input: CognitoSyncUpdateInput): Promise<CognitoSyncRecord | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

interface CognitoSyncDocument extends CognitoSyncRecord {
  _id: string;
}

function now() {
  return new Date();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function clone(record: CognitoSyncRecord): CognitoSyncRecord {
  return {
    ...record,
    lastSyncedAt: record.lastSyncedAt ? new Date(record.lastSyncedAt) : undefined,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function toDocument(record: CognitoSyncRecord): CognitoSyncDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: CognitoSyncDocument | null): CognitoSyncRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `cognito_sync_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toRecord(tenantId: string, input: CognitoSyncCreateInput): CognitoSyncRecord {
  const timestamp = now();
  return {
    id: makeId(),
    tenantId,
    userId: input.userId,
    cognitoUsername: input.cognitoUsername,
    email: normalize(input.email),
    status: "PENDING",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function matchesSearch(record: CognitoSyncRecord, search: string): boolean {
  const query = search.toLowerCase();
  return (
    record.userId.toLowerCase().includes(query) ||
    record.email.toLowerCase().includes(query) ||
    (record.cognitoUsername?.toLowerCase().includes(query) ?? false) ||
    record.id.toLowerCase().includes(query)
  );
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

export class InMemoryCognitoSyncRepository implements CognitoSyncRepository {
  private readonly records = new Map<string, Map<string, CognitoSyncRecord>>();

  private bucket(tenantId: string): Map<string, CognitoSyncRecord> {
    let bucket = this.records.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, CognitoSyncRecord>();
      this.records.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter: CognitoSyncListFilter = {}) {
    return [...this.bucket(normalizeTenantId(tenantId)).values()]
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    const record = this.bucket(normalizeTenantId(tenantId)).get(id) ?? null;
    return record ? clone(record) : null;
  }

  async getByUserId(tenantId: string, userId: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const record = [...this.bucket(normalizedTenantId).values()].find((item) => item.userId === userId) ?? null;
    return record ? clone(record) : null;
  }

  async create(tenantId: string, input: CognitoSyncCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const existing = await this.getByUserId(normalizedTenantId, input.userId);
    if (existing) {
      throw new ConflictError("cognito sync already exists for user");
    }
    const record = toRecord(normalizedTenantId, input);
    this.bucket(normalizedTenantId).set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: CognitoSyncUpdateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const bucket = this.bucket(normalizedTenantId);
    const existing = bucket.get(id);
    if (!existing) return null;
    const nextStatus = input.status ?? existing.status;
    const updated = clone({
      ...existing,
      ...input,
      status: nextStatus,
      email: existing.email,
      updatedAt: now(),
    });
    bucket.set(id, updated);
    return clone(updated);
  }

  async delete(tenantId: string, id: string) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    return this.bucket(normalizedTenantId).delete(id);
  }
}

export class MongoCognitoSyncRepository implements CognitoSyncRepository {
  constructor(private readonly collection: CollectionAdapter<CognitoSyncDocument>) {}

  async list(tenantId: string, filter: CognitoSyncListFilter = {}) {
    const records = await this.collection.findMany({ tenantId: normalizeTenantId(tenantId) });
    return records
      .map((record) => fromDocument(record))
      .filter((record): record is CognitoSyncRecord => record !== null)
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      });
  }

  async getById(tenantId: string, id: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByUserId(tenantId: string, userId: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), userId }));
  }

  async create(tenantId: string, input: CognitoSyncCreateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const existing = await this.getByUserId(normalizedTenantId, input.userId);
    if (existing) {
      throw new ConflictError("cognito sync already exists for user");
    }
    const record = toRecord(normalizedTenantId, input);
    await this.collection.insertOne(toDocument(record));
    return record;
  }

  async update(tenantId: string, id: string, input: CognitoSyncUpdateInput) {
    const existing = await this.getById(tenantId, id);
    if (!existing) return null;
    const nextStatus = input.status ?? existing.status;
    const updated = clone({
      ...existing,
      ...input,
      status: nextStatus,
      email: existing.email,
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

export async function createCognitoSyncRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<CognitoSyncRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryCognitoSyncRepository();
  }
  const collection = await getCollection<CognitoSyncDocument>("identity_cognito_sync", env);
  await collection.createIndex({ tenantId: 1, userId: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, email: 1 });
  return new MongoCognitoSyncRepository(createMongoCollectionAdapter(collection));
}

export const cognitoSyncRepository = createCognitoSyncRepository();
