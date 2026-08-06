import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { CurriculumCreateInput, CurriculumListFilter, CurriculumRecord, CurriculumUpdateInput } from "./curricula.model";

export interface CurriculumRepository {
  list(tenantId: string, filter: CurriculumListFilter): Promise<CurriculumRecord[]>;
  getById(tenantId: string, id: string): Promise<CurriculumRecord | null>;
  create(tenantId: string, input: CurriculumCreateInput): Promise<CurriculumRecord>;
  update(tenantId: string, id: string, input: CurriculumUpdateInput): Promise<CurriculumRecord | null>;
  deactivate(tenantId: string, id: string): Promise<CurriculumRecord | null>;
}

interface CurriculumDocument extends CurriculumRecord { _id: string }
const tenant = (value: string) => {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError("tenantId is required");
  return normalized;
};
const clone = (record: CurriculumRecord): CurriculumRecord => ({
  ...record,
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
  deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
});
const fromDocument = (document: CurriculumDocument | null): CurriculumRecord | null => {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
};
const toDocument = (record: CurriculumRecord): CurriculumDocument => ({ ...clone(record), _id: record.id });
const normalizedName = (value: string) => value.trim().toLocaleLowerCase();

export class InMemoryCurriculumRepository implements CurriculumRepository {
  private readonly records = new Map<string, Map<string, CurriculumRecord>>();
  private bucket(tenantId: string) {
    const key = tenant(tenantId);
    let bucket = this.records.get(key);
    if (!bucket) { bucket = new Map(); this.records.set(key, bucket); }
    return bucket;
  }
  async list(tenantId: string, filter: CurriculumListFilter) {
    return [...this.bucket(tenantId).values()]
      .filter((item) => (!filter.status || item.status === filter.status) && (!filter.type || item.type === filter.type))
      .sort((a, b) => a.name.localeCompare(b.name)).map(clone);
  }
  async getById(tenantId: string, id: string) { return this.bucket(tenantId).get(id) ? clone(this.bucket(tenantId).get(id)!) : null; }
  async create(tenantId: string, input: CurriculumCreateInput) {
    const bucket = this.bucket(tenantId);
    if ([...bucket.values()].some((item) => normalizedName(item.name) === normalizedName(input.name))) {
      throw new ConflictError("curriculum name must be unique");
    }
    const timestamp = new Date();
    const id = `curriculum_${crypto.randomUUID()}`;
    const record: CurriculumRecord = { id, tenantId: tenant(tenantId), code: `CUR-${id.slice(-6).toUpperCase()}`, ...input, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    bucket.set(id, record);
    return clone(record);
  }
  async update(tenantId: string, id: string, input: CurriculumUpdateInput) {
    const bucket = this.bucket(tenantId); const current = bucket.get(id); if (!current) return null;
    if (input.name && [...bucket.values()].some((item) => item.id !== id && normalizedName(item.name) === normalizedName(input.name!))) {
      throw new ConflictError("curriculum name must be unique");
    }
    const status = input.status ?? current.status;
    const next = clone({
      ...current,
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      authorityName: input.authorityName !== undefined ? input.authorityName : current.authorityName,
      status,
      updatedAt: new Date(),
      deactivatedAt: status === "INACTIVE" ? current.deactivatedAt ?? new Date() : undefined,
    });
    bucket.set(id, next); return clone(next);
  }
  async deactivate(tenantId: string, id: string) { return this.update(tenantId, id, { status: "INACTIVE" }); }
}

class MongoCurriculumRepository implements CurriculumRepository {
  constructor(private readonly collection: CollectionAdapter<CurriculumDocument>) {}
  async list(tenantId: string, filter: CurriculumListFilter) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    if (filter.status) query.status = filter.status;
    if (filter.type) query.type = filter.type;
    return (await this.collection.findMany(query)).map(fromDocument).filter((item): item is CurriculumRecord => Boolean(item)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async getById(tenantId: string, id: string) { return fromDocument(await this.collection.findOne({ tenantId: tenant(tenantId), _id: id })); }
  async create(tenantId: string, input: CurriculumCreateInput) {
    const normalizedTenant = tenant(tenantId);
    const duplicate = await this.collection.findOne({ tenantId: normalizedTenant, normalizedName: normalizedName(input.name) });
    if (duplicate) throw new ConflictError("curriculum name must be unique");
    const timestamp = new Date(); const id = `curriculum_${crypto.randomUUID()}`;
    const record: CurriculumRecord = { id, tenantId: normalizedTenant, code: `CUR-${id.slice(-6).toUpperCase()}`, ...input, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    await this.collection.insertOne({ ...toDocument(record), normalizedName: normalizedName(record.name) } as CurriculumDocument);
    return clone(record);
  }
  async update(tenantId: string, id: string, input: CurriculumUpdateInput) {
    const current = await this.getById(tenantId, id); if (!current) return null;
    if (input.name) {
      const duplicate = await this.collection.findOne({ tenantId: tenant(tenantId), normalizedName: normalizedName(input.name) });
      if (duplicate && duplicate.id !== id) throw new ConflictError("curriculum name must be unique");
    }
    const status = input.status ?? current.status;
    const next = clone({
      ...current,
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      authorityName: input.authorityName !== undefined ? input.authorityName : current.authorityName,
      status,
      updatedAt: new Date(),
      deactivatedAt: status === "INACTIVE" ? current.deactivatedAt ?? new Date() : undefined,
    });
    await this.collection.replaceOne({ tenantId: tenant(tenantId), _id: id }, { ...toDocument(next), normalizedName: normalizedName(next.name) } as CurriculumDocument);
    return next;
  }
  async deactivate(tenantId: string, id: string) { return this.update(tenantId, id, { status: "INACTIVE" }); }
}

const runtimeEnv = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
const hasMongo = (env: MongoEnvLike) => Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
export async function createCurriculumRepository(env: MongoEnvLike = runtimeEnv()): Promise<CurriculumRepository> {
  if (!hasMongo(env)) return new InMemoryCurriculumRepository();
  const collection = await getCollection<CurriculumDocument>("academics_curricula", env);
  await collection.createIndex({ tenantId: 1, normalizedName: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  return new MongoCurriculumRepository(createMongoCollectionAdapter(collection));
}

let defaultRepository: Promise<CurriculumRepository> | undefined;
const getDefault = () => defaultRepository ??= createCurriculumRepository();
export const curriculumRepository: CurriculumRepository = {
  list: async (...args) => (await getDefault()).list(...args),
  getById: async (...args) => (await getDefault()).getById(...args),
  create: async (...args) => (await getDefault()).create(...args),
  update: async (...args) => (await getDefault()).update(...args),
  deactivate: async (...args) => (await getDefault()).deactivate(...args),
};
