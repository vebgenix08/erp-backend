import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { FirstAdminBootstrapCreateInput, FirstAdminBootstrapRecord } from "./bootstrap.model";

export interface FirstAdminBootstrapRepository {
  list(): Promise<FirstAdminBootstrapRecord[]>;
  getByTenantId(tenantId: string): Promise<FirstAdminBootstrapRecord | null>;
  create(input: FirstAdminBootstrapRecord): Promise<FirstAdminBootstrapRecord>;
  update(tenantId: string, input: Partial<FirstAdminBootstrapRecord>): Promise<FirstAdminBootstrapRecord | null>;
}

interface FirstAdminBootstrapDocument extends FirstAdminBootstrapRecord {
  _id: string;
}

function now() {
  return new Date();
}

function clone(record: FirstAdminBootstrapRecord): FirstAdminBootstrapRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    invitedAt: record.invitedAt ? new Date(record.invitedAt) : undefined,
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
    lastInviteAttemptAt: record.lastInviteAttemptAt ? new Date(record.lastInviteAttemptAt) : undefined,
  };
}

function toDocument(record: FirstAdminBootstrapRecord): FirstAdminBootstrapDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: FirstAdminBootstrapDocument | null): FirstAdminBootstrapRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `bootstrap_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

export class InMemoryFirstAdminBootstrapRepository implements FirstAdminBootstrapRepository {
  private readonly records = new Map<string, FirstAdminBootstrapRecord>();

  async list() {
    return [...this.records.values()].map(clone).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getByTenantId(tenantId: string) {
    const normalized = normalizeTenantId(tenantId);
    const record = this.records.get(normalized) ?? null;
    return record ? clone(record) : null;
  }

  async create(input: FirstAdminBootstrapRecord) {
    const existing = await this.getByTenantId(input.tenantId);
    if (existing) {
      throw new ConflictError("first admin bootstrap already exists for tenant");
    }
    const record = clone(input);
    this.records.set(normalizeTenantId(input.tenantId), record);
    return clone(record);
  }

  async update(tenantId: string, input: Partial<FirstAdminBootstrapRecord>) {
    const normalized = normalizeTenantId(tenantId);
    const existing = this.records.get(normalized);
    if (!existing) return null;
    const updated = clone({
      ...existing,
      ...input,
      tenantId: normalized,
      updatedAt: now(),
    });
    this.records.set(normalized, updated);
    return clone(updated);
  }
}

export class MongoFirstAdminBootstrapRepository implements FirstAdminBootstrapRepository {
  constructor(private readonly collection: CollectionAdapter<FirstAdminBootstrapDocument>) {}

  async list() {
    const records = await this.collection.findMany({});
    return records
      .map((record) => fromDocument(record))
      .filter((record): record is FirstAdminBootstrapRecord => record !== null)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async getByTenantId(tenantId: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId) }));
  }

  async create(input: FirstAdminBootstrapRecord) {
    const existing = await this.getByTenantId(input.tenantId);
    if (existing) {
      throw new ConflictError("first admin bootstrap already exists for tenant");
    }
    const record = clone(input);
    try {
      await this.collection.insertOne(toDocument(record));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        throw new ConflictError("first admin bootstrap already exists for tenant");
      }
      throw error;
    }
    return record;
  }

  async update(tenantId: string, input: Partial<FirstAdminBootstrapRecord>) {
    const normalized = normalizeTenantId(tenantId);
    const existing = await this.getByTenantId(normalized);
    if (!existing) return null;
    const updated = clone({
      ...existing,
      ...input,
      tenantId: normalized,
      updatedAt: now(),
    });
    const replaced = await this.collection.replaceOne({ tenantId: normalized, _id: existing.id }, toDocument(updated));
    return replaced ? updated : null;
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createFirstAdminBootstrapRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<FirstAdminBootstrapRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryFirstAdminBootstrapRepository();
  }
  const collection = await getCollection<FirstAdminBootstrapDocument>("platform_first_admin_bootstraps", env);
  await collection.createIndex({ tenantId: 1 }, { unique: true });
  return new MongoFirstAdminBootstrapRepository(createMongoCollectionAdapter(collection));
}

export const firstAdminBootstrapRepository = createFirstAdminBootstrapRepository();
