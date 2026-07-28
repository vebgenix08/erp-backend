import { ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { FeatureFlagCreateInput, FeatureFlagRecord, FeatureFlagUpdateInput } from "./feature-flags.model";

export interface FeatureFlagRepository {
  list(): Promise<FeatureFlagRecord[]>;
  getById(id: string): Promise<FeatureFlagRecord | null>;
  getByCode(code: string): Promise<FeatureFlagRecord | null>;
  create(input: FeatureFlagCreateInput): Promise<FeatureFlagRecord>;
  update(id: string, input: FeatureFlagUpdateInput): Promise<FeatureFlagRecord | null>;
}

interface FeatureFlagDocument extends FeatureFlagRecord {
  _id: string;
}

function now() {
  return new Date();
}

function clone(record: FeatureFlagRecord): FeatureFlagRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
  };
}

function toDocument(record: FeatureFlagRecord): FeatureFlagDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: FeatureFlagDocument | null): FeatureFlagRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `feature_flag_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export class InMemoryFeatureFlagRepository implements FeatureFlagRepository {
  private readonly records = new Map<string, FeatureFlagRecord>();

  async list() {
    return [...this.records.values()].map(clone).sort((left, right) => left.code.localeCompare(right.code));
  }

  async getById(id: string) {
    const record = this.records.get(id) ?? null;
    return record ? clone(record) : null;
  }

  async getByCode(code: string) {
    const normalized = normalizeCode(code);
    const record = [...this.records.values()].find((item) => item.code === normalized) ?? null;
    return record ? clone(record) : null;
  }

  async create(input: FeatureFlagCreateInput) {
    const existing = await this.getByCode(input.code);
    if (existing) throw new ConflictError("feature flag code must be unique");
    const timestamp = now();
    const record: FeatureFlagRecord = {
      id: makeId(),
      code: normalizeCode(input.code),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      isEnabled: input.isEnabled ?? true,
      status: "ACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return clone(record);
  }

  async update(id: string, input: FeatureFlagUpdateInput) {
    const existing = this.records.get(id);
    if (!existing) return null;
    if (input.name === undefined && input.description === undefined && input.isEnabled === undefined && input.status === undefined) {
      return clone(existing);
    }
    const nextStatus = input.status ?? existing.status;
    const updated: FeatureFlagRecord = clone({
      ...existing,
      name: input.name ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
      isEnabled: input.isEnabled ?? existing.isEnabled,
      status: nextStatus,
      deactivatedAt:
        nextStatus === "INACTIVE" ? existing.deactivatedAt ?? now() : nextStatus === "ACTIVE" ? undefined : existing.deactivatedAt,
      updatedAt: now(),
    });
    this.records.set(id, updated);
    return clone(updated);
  }
}

class MongoFeatureFlagRepository implements FeatureFlagRepository {
  constructor(private readonly collection: CollectionAdapter<FeatureFlagDocument>) {}
  async list() {
    const records = await this.collection.findMany({});
    return records.map((record) => fromDocument(record)).filter((record): record is FeatureFlagRecord => record !== null).sort((left, right) => left.code.localeCompare(right.code));
  }
  async getById(id: string) {
    return fromDocument(await this.collection.findOne({ _id: id }));
  }
  async getByCode(code: string) {
    return fromDocument(await this.collection.findOne({ code: normalizeCode(code) }));
  }
  async create(input: FeatureFlagCreateInput) {
    const existing = await this.getByCode(input.code);
    if (existing) throw new ConflictError("feature flag code must be unique");
    const timestamp = now();
    const record: FeatureFlagRecord = {
      id: makeId(),
      code: normalizeCode(input.code),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      isEnabled: input.isEnabled ?? true,
      status: "ACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.collection.insertOne(toDocument(record));
    return clone(record);
  }
  async update(id: string, input: FeatureFlagUpdateInput) {
    const existing = await this.getById(id);
    if (!existing) return null;
    const nextStatus = input.status ?? existing.status;
    const updated: FeatureFlagRecord = clone({
      ...existing,
      name: input.name ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
      isEnabled: input.isEnabled ?? existing.isEnabled,
      status: nextStatus,
      deactivatedAt:
        nextStatus === "INACTIVE" ? existing.deactivatedAt ?? now() : nextStatus === "ACTIVE" ? undefined : existing.deactivatedAt,
      updatedAt: now(),
    });
    const replaced = await this.collection.replaceOne({ _id: id }, toDocument(updated));
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

export async function createFeatureFlagRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<FeatureFlagRepository> {
  if (!hasMongoEnv(env)) return new InMemoryFeatureFlagRepository();
  const collection = await getCollection<FeatureFlagDocument>("platform_feature_flags", env);
  await collection.createIndex({ code: 1 }, { unique: true });
  return new MongoFeatureFlagRepository(createMongoCollectionAdapter(collection));
}

export const featureFlagRepository = createFeatureFlagRepository();
