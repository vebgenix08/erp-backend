import { ConflictError } from "@school-erp/errors";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import type { SubjectCatalogueCreateInput, SubjectCatalogueFilter, SubjectCatalogueRecord, SubjectCatalogueUpdateInput } from "./subject-catalogue.model";

interface Document extends SubjectCatalogueRecord { _id: string; normalizedName: string }
const clone = (value: SubjectCatalogueRecord): SubjectCatalogueRecord => ({ ...value, createdAt: new Date(value.createdAt), updatedAt: new Date(value.updatedAt), ...(value.deactivatedAt ? { deactivatedAt: new Date(value.deactivatedAt) } : {}) });
const normalized = (value: string) => value.trim().toLocaleLowerCase();

export interface SubjectCatalogueRepository {
  list(tenantId: string, filter: SubjectCatalogueFilter): Promise<SubjectCatalogueRecord[]>;
  get(tenantId: string, id: string): Promise<SubjectCatalogueRecord | null>;
  create(tenantId: string, actorId: string, input: SubjectCatalogueCreateInput): Promise<SubjectCatalogueRecord>;
  update(tenantId: string, actorId: string, id: string, input: SubjectCatalogueUpdateInput): Promise<SubjectCatalogueRecord | null>;
  deactivate(tenantId: string, actorId: string, id: string, reason: string): Promise<SubjectCatalogueRecord | null>;
}

function matches(record: SubjectCatalogueRecord, filter: SubjectCatalogueFilter) {
  if (filter.status && record.status !== filter.status) return false;
  if (filter.departmentId && record.departmentId !== filter.departmentId) return false;
  if (filter.subjectDomain && record.subjectDomain !== filter.subjectDomain) return false;
  const search = filter.search?.toLocaleLowerCase();
  return !search || [record.name, record.code, record.shortName].some((item) => item?.toLocaleLowerCase().includes(search));
}

export class InMemorySubjectCatalogueRepository implements SubjectCatalogueRepository {
  private records = new Map<string, SubjectCatalogueRecord>();
  async list(tenantId: string, filter: SubjectCatalogueFilter) { return [...this.records.values()].filter((item) => item.tenantId === tenantId && matches(item, filter)).sort((a, b) => a.name.localeCompare(b.name)).map(clone); }
  async get(tenantId: string, id: string) { const value = this.records.get(id); return value?.tenantId === tenantId ? clone(value) : null; }
  async create(tenantId: string, actorId: string, input: SubjectCatalogueCreateInput) {
    if ([...this.records.values()].some((item) => item.tenantId === tenantId && normalized(item.name) === normalized(input.name))) throw new ConflictError("subject catalogue name already exists");
    const id = `subject_catalogue_${crypto.randomUUID()}`, now = new Date();
    const record: SubjectCatalogueRecord = { id, tenantId, code: `SUB-${id.slice(-6).toUpperCase()}`, ...input, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    this.records.set(id, record); return clone(record);
  }
  async update(tenantId: string, actorId: string, id: string, input: SubjectCatalogueUpdateInput) {
    const current = await this.get(tenantId, id); if (!current) return null;
    if (current.version !== input.expectedVersion) throw new ConflictError("subject catalogue record was changed by another request");
    if (input.name && [...this.records.values()].some((item) => item.tenantId === tenantId && item.id !== id && normalized(item.name) === normalized(input.name!))) throw new ConflictError("subject catalogue name already exists");
    const { expectedVersion: _expectedVersion, ...patch } = input;
    const next: SubjectCatalogueRecord = { ...current, ...patch, id, tenantId, version: current.version + 1, updatedAt: new Date(), updatedBy: actorId };
    this.records.set(id, next); return clone(next);
  }
  async deactivate(tenantId: string, actorId: string, id: string, reason: string) {
    const current = await this.get(tenantId, id); if (!current) return null;
    const now = new Date(), next: SubjectCatalogueRecord = { ...current, status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    this.records.set(id, next); return clone(next);
  }
}

class MongoSubjectCatalogueRepository implements SubjectCatalogueRepository {
  constructor(private collection: CollectionAdapter<Document>) {}
  private from(document: Document | null) { if (!document) return null; const { _id, normalizedName, ...record } = document; return clone({ ...record, id: record.id || _id }); }
  async list(tenantId: string, filter: SubjectCatalogueFilter) { return (await this.collection.findMany({ tenantId })).map((item) => this.from(item)!).filter((item) => matches(item, filter)).sort((a, b) => a.name.localeCompare(b.name)); }
  async get(tenantId: string, id: string) { return this.from(await this.collection.findOne({ tenantId, _id: id })); }
  async create(tenantId: string, actorId: string, input: SubjectCatalogueCreateInput) {
    if (await this.collection.findOne({ tenantId, normalizedName: normalized(input.name) })) throw new ConflictError("subject catalogue name already exists");
    const id = `subject_catalogue_${crypto.randomUUID()}`, now = new Date();
    const record: SubjectCatalogueRecord = { id, tenantId, code: `SUB-${id.slice(-6).toUpperCase()}`, ...input, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    await this.collection.insertOne({ ...record, _id: id, normalizedName: normalized(record.name) }); return clone(record);
  }
  async update(tenantId: string, actorId: string, id: string, input: SubjectCatalogueUpdateInput) {
    const current = await this.get(tenantId, id); if (!current) return null;
    if (current.version !== input.expectedVersion) throw new ConflictError("subject catalogue record was changed by another request");
    const name = input.name ?? current.name;
    const duplicate = await this.collection.findOne({ tenantId, normalizedName: normalized(name) });
    if (duplicate && duplicate.id !== id) throw new ConflictError("subject catalogue name already exists");
    const { expectedVersion, ...patch } = input;
    const next: SubjectCatalogueRecord = { ...current, ...patch, updatedAt: new Date(), updatedBy: actorId, version: current.version + 1 };
    const replaced = await this.collection.replaceOne({ tenantId, _id: id, version: expectedVersion }, { ...next, _id: id, normalizedName: normalized(next.name) });
    if (!replaced) throw new ConflictError("subject catalogue record was changed by another request");
    return clone(next);
  }
  async deactivate(tenantId: string, actorId: string, id: string, reason: string) {
    const current = await this.get(tenantId, id); if (!current) return null;
    const now = new Date(), next: SubjectCatalogueRecord = { ...current, status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    await this.collection.replaceOne({ tenantId, _id: id, version: current.version }, { ...next, _id: id, normalizedName: normalized(next.name) }); return clone(next);
  }
}

const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: Promise<SubjectCatalogueRepository> | undefined;
export async function createSubjectCatalogueRepository(runtime: MongoEnvLike = env()): Promise<SubjectCatalogueRepository> {
  if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) return new InMemorySubjectCatalogueRepository();
  const collection = await getCollection<Document>("subject_catalogue", runtime);
  await collection.createIndex({ tenantId: 1, normalizedName: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  return new MongoSubjectCatalogueRepository(createMongoCollectionAdapter(collection));
}
const repository = () => singleton ??= createSubjectCatalogueRepository();
export const subjectCatalogueRepository: SubjectCatalogueRepository = {
  list: async (...args) => (await repository()).list(...args), get: async (...args) => (await repository()).get(...args),
  create: async (...args) => (await repository()).create(...args), update: async (...args) => (await repository()).update(...args),
  deactivate: async (...args) => (await repository()).deactivate(...args),
};
