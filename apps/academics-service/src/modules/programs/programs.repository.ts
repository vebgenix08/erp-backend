import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { ProgramCreateInput, ProgramListFilter, ProgramRecord, ProgramUpdateInput } from "./programs.model";

export interface ProgramRepository {
  list(tenantId: string, filter: ProgramListFilter): Promise<ProgramRecord[]>;
  getById(tenantId: string, id: string): Promise<ProgramRecord | null>;
  getByCode(tenantId: string, campusId: string, code: string): Promise<ProgramRecord | null>;
  reserveNextCode(tenantId: string, campusId: string): Promise<string>;
  create(tenantId: string, input: ProgramCreateInput & { code: string }): Promise<ProgramRecord>;
  update(tenantId: string, id: string, input: ProgramUpdateInput): Promise<ProgramRecord | null>;
  deactivate(tenantId: string, id: string): Promise<ProgramRecord | null>;
}

interface ProgramDocument extends ProgramRecord {
  _id: string;
}

function now() {
  return new Date();
}

function clone(record: ProgramRecord): ProgramRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
  };
}

function toDocument(record: ProgramRecord): ProgramDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: ProgramDocument | null): ProgramRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `program_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new BadRequestError("tenantId is required");
  }
  return normalized;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export class InMemoryProgramRepository implements ProgramRepository {
  private readonly records = new Map<string, Map<string, ProgramRecord>>();
  private readonly sequences = new Map<string, number>();

  async reserveNextCode(tenantId: string, campusId: string) {
    const key = `${normalizeTenantId(tenantId)}:${campusId.trim()}`;
    const next = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, next);
    return `PROG-${String(next).padStart(3, "0")}`;
  }

  private bucket(tenantId: string): Map<string, ProgramRecord> {
    let bucket = this.records.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, ProgramRecord>();
      this.records.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter: ProgramListFilter) {
    return [...this.bucket(normalizeTenantId(tenantId)).values()]
      .filter((record) => {
        if (record.campusId !== filter.campusId) return false;
        if (filter.status && record.status !== filter.status) return false;
        return true;
      })
      .sort((left, right) => left.code.localeCompare(right.code))
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    const record = this.bucket(normalizeTenantId(tenantId)).get(id) ?? null;
    return record ? clone(record) : null;
  }

  async getByCode(tenantId: string, campusId: string, code: string) {
    const normalized = normalizeCode(code);
    const record = [...this.bucket(normalizeTenantId(tenantId)).values()].find((item) => item.campusId === campusId && item.code === normalized) ?? null;
    return record ? clone(record) : null;
  }

  async create(tenantId: string, input: ProgramCreateInput & { code: string }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const existing = await this.getByCode(normalizedTenantId, input.campusId, input.code);
    if (existing) {
      throw new ConflictError("program code must be unique");
    }
    const timestamp = now();
    const record: ProgramRecord = {
      id: makeId(),
      tenantId: normalizedTenantId,
      campusId: input.campusId,
      code: normalizeCode(input.code),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      status: "ACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.bucket(normalizedTenantId).set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: ProgramUpdateInput) {
    const bucket = this.bucket(normalizeTenantId(tenantId));
    const existing = bucket.get(id);
    if (!existing) return null;
    const nextStatus = input.status ?? existing.status;
    const updated: ProgramRecord = clone({
      ...existing,
      name: input.name ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
      status: nextStatus,
      deactivatedAt:
        nextStatus === "INACTIVE"
          ? existing.deactivatedAt ?? now()
          : nextStatus === "ACTIVE"
            ? undefined
            : existing.deactivatedAt,
      updatedAt: now(),
    });
    bucket.set(id, updated);
    return clone(updated);
  }

  async deactivate(tenantId: string, id: string) {
    return this.update(tenantId, id, { status: "INACTIVE" });
  }
}

interface SequenceDocument { _id: string; value: number; }
class MongoProgramRepository implements ProgramRepository {
  constructor(private readonly collection: CollectionAdapter<ProgramDocument>, private readonly sequences: Awaited<ReturnType<typeof getCollection<SequenceDocument>>>) {}

  async reserveNextCode(tenantId: string, campusId: string) {
    const result = await this.sequences.findOneAndUpdate({ _id: `program:${normalizeTenantId(tenantId)}:${campusId}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: "after" });
    return `PROG-${String(result?.value ?? 1).padStart(3, "0")}`;
  }

  async list(tenantId: string, filter: ProgramListFilter) {
    const records = await this.collection.findMany({ tenantId: normalizeTenantId(tenantId), campusId: filter.campusId });
    return records
      .map((record) => fromDocument(record))
      .filter((record): record is ProgramRecord => record !== null)
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        return true;
      })
      .sort((left, right) => left.code.localeCompare(right.code));
  }

  async getById(tenantId: string, id: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), _id: id }));
  }

  async getByCode(tenantId: string, campusId: string, code: string) {
    return fromDocument(await this.collection.findOne({ tenantId: normalizeTenantId(tenantId), campusId, code: normalizeCode(code) }));
  }

  async create(tenantId: string, input: ProgramCreateInput & { code: string }) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const existing = await this.getByCode(normalizedTenantId, input.campusId, input.code);
    if (existing) {
      throw new ConflictError("program code must be unique");
    }
    const timestamp = now();
    const record: ProgramRecord = {
      id: makeId(),
      tenantId: normalizedTenantId,
      campusId: input.campusId,
      code: normalizeCode(input.code),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      status: "ACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.collection.insertOne(toDocument(record));
    return clone(record);
  }

  async update(tenantId: string, id: string, input: ProgramUpdateInput) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const existing = await this.getById(normalizedTenantId, id);
    if (!existing) return null;
    const nextStatus = input.status ?? existing.status;
    const updated: ProgramRecord = clone({
      ...existing,
      name: input.name ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description?.trim() || undefined : existing.description,
      status: nextStatus,
      deactivatedAt:
        nextStatus === "INACTIVE"
          ? existing.deactivatedAt ?? now()
          : nextStatus === "ACTIVE"
            ? undefined
            : existing.deactivatedAt,
      updatedAt: now(),
    });
    const replaced = await this.collection.replaceOne({ tenantId: normalizedTenantId, _id: id }, toDocument(updated));
    return replaced ? updated : null;
  }

  async deactivate(tenantId: string, id: string) {
    return this.update(tenantId, id, { status: "INACTIVE" });
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createProgramRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<ProgramRepository> {
  if (!hasMongoEnv(env)) {
    return new InMemoryProgramRepository();
  }
  const collection = await getCollection<ProgramDocument>("academics_programs", env);
  const sequences = await getCollection<SequenceDocument>("academics_sequences", env);
  await collection.createIndex({ tenantId: 1, campusId: 1, code: 1 }, { unique: true });
  return new MongoProgramRepository(createMongoCollectionAdapter(collection), sequences);
}

let defaultRepository: Promise<ProgramRepository> | undefined;
function getDefaultRepository() { defaultRepository ??= createProgramRepository(); return defaultRepository; }
export const programRepository: ProgramRepository = {
  list: async (...args) => (await getDefaultRepository()).list(...args),
  getById: async (...args) => (await getDefaultRepository()).getById(...args),
  getByCode: async (...args) => (await getDefaultRepository()).getByCode(...args),
  reserveNextCode: async (...args) => (await getDefaultRepository()).reserveNextCode(...args),
  create: async (...args) => (await getDefaultRepository()).create(...args),
  update: async (...args) => (await getDefaultRepository()).update(...args),
  deactivate: async (...args) => (await getDefaultRepository()).deactivate(...args),
};

export { normalizeCode };
