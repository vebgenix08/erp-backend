import { ConflictError } from "@school-erp/errors";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import type { CurriculumSubjectCreateInput, CurriculumSubjectFilter, CurriculumSubjectRecord, CurriculumSubjectUpdateInput } from "./curriculum-subjects.model";

const clone = (record: CurriculumSubjectRecord): CurriculumSubjectRecord => ({
  ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt),
  ...(record.deactivatedAt ? { deactivatedAt: new Date(record.deactivatedAt) } : {}),
});
const naturalKey = (record: Pick<CurriculumSubjectRecord, "academicUnitId" | "curriculumId" | "programId" | "academicLevelId" | "subjectCatalogueId">) =>
  [record.academicUnitId, record.curriculumId, record.programId, record.academicLevelId, record.subjectCatalogueId].join("|");

export interface CurriculumSubjectRepository {
  list(tenantId: string, filter: CurriculumSubjectFilter): Promise<CurriculumSubjectRecord[]>;
  get(tenantId: string, id: string): Promise<CurriculumSubjectRecord | null>;
  create(tenantId: string, actorId: string, input: CurriculumSubjectCreateInput): Promise<CurriculumSubjectRecord>;
  update(tenantId: string, actorId: string, id: string, input: CurriculumSubjectUpdateInput): Promise<CurriculumSubjectRecord | null>;
  deactivate(tenantId: string, actorId: string, id: string, reason: string): Promise<CurriculumSubjectRecord | null>;
}

export class InMemoryCurriculumSubjectRepository implements CurriculumSubjectRepository {
  private readonly records = new Map<string, CurriculumSubjectRecord>();
  async list(tenantId: string, filter: CurriculumSubjectFilter) {
    return [...this.records.values()].filter((record) => record.tenantId === tenantId &&
      Object.entries(filter).every(([key, value]) => record[key as keyof CurriculumSubjectRecord] === value)).map(clone);
  }
  async get(tenantId: string, id: string) { const record = this.records.get(id); return record?.tenantId === tenantId ? clone(record) : null; }
  async create(tenantId: string, actorId: string, input: CurriculumSubjectCreateInput) {
    if ([...this.records.values()].some((record) => record.tenantId === tenantId && record.status === "ACTIVE" && naturalKey(record) === naturalKey(input))) throw new ConflictError("curriculum subject already exists");
    const now = new Date(), id = `curriculum_subject_${crypto.randomUUID()}`;
    const record: CurriculumSubjectRecord = { id, tenantId, ...input, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    this.records.set(id, record); return clone(record);
  }
  async update(tenantId: string, actorId: string, id: string, input: CurriculumSubjectUpdateInput) {
    const current = await this.get(tenantId, id); if (!current) return null;
    if (current.version !== input.expectedVersion) throw new ConflictError("curriculum subject was changed by another request");
    const { expectedVersion: _expectedVersion, ...patch } = input;
    const next: CurriculumSubjectRecord = { ...current, ...patch, updatedAt: new Date(), updatedBy: actorId, version: current.version + 1 };
    this.records.set(id, next); return clone(next);
  }
  async deactivate(tenantId: string, actorId: string, id: string, reason: string) {
    const current = await this.get(tenantId, id); if (!current) return null;
    const now = new Date(), next: CurriculumSubjectRecord = { ...current, status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    this.records.set(id, next); return clone(next);
  }
}

interface Document extends CurriculumSubjectRecord { _id: string; naturalKey: string }
class MongoCurriculumSubjectRepository implements CurriculumSubjectRepository {
  constructor(private readonly collection: CollectionAdapter<Document>) {}
  private from(document: Document | null) { if (!document) return null; const { _id, naturalKey: _naturalKey, ...record } = document; return clone({ ...record, id: record.id || _id }); }
  async list(tenantId: string, filter: CurriculumSubjectFilter) { return (await this.collection.findMany({ tenantId, ...filter })).map((record) => this.from(record)!); }
  async get(tenantId: string, id: string) { return this.from(await this.collection.findOne({ tenantId, _id: id })); }
  async create(tenantId: string, actorId: string, input: CurriculumSubjectCreateInput) {
    const key = naturalKey(input);
    if (await this.collection.findOne({ tenantId, naturalKey: key, status: "ACTIVE" })) throw new ConflictError("curriculum subject already exists");
    const now = new Date(), id = `curriculum_subject_${crypto.randomUUID()}`;
    const record: CurriculumSubjectRecord = { id, tenantId, ...input, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    await this.collection.insertOne({ ...record, _id: id, naturalKey: key }); return clone(record);
  }
  async update(tenantId: string, actorId: string, id: string, input: CurriculumSubjectUpdateInput) {
    const current = await this.get(tenantId, id); if (!current) return null;
    if (current.version !== input.expectedVersion) throw new ConflictError("curriculum subject was changed by another request");
    const { expectedVersion, ...patch } = input;
    const next: CurriculumSubjectRecord = { ...current, ...patch, updatedAt: new Date(), updatedBy: actorId, version: current.version + 1 };
    const replaced = await this.collection.replaceOne({ tenantId, _id: id, version: expectedVersion }, { ...next, _id: id, naturalKey: naturalKey(next) });
    if (!replaced) throw new ConflictError("curriculum subject was changed by another request"); return clone(next);
  }
  async deactivate(tenantId: string, actorId: string, id: string, reason: string) {
    const current = await this.get(tenantId, id); if (!current) return null; const now = new Date();
    const next: CurriculumSubjectRecord = { ...current, status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    const replaced = await this.collection.replaceOne({ tenantId, _id: id, version: current.version }, { ...next, _id: id, naturalKey: naturalKey(next) });
    if (!replaced) throw new ConflictError("curriculum subject was changed by another request"); return clone(next);
  }
}
const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: Promise<CurriculumSubjectRepository> | undefined;
export function curriculumSubjectRepository(runtime: MongoEnvLike = env()) {
  return singleton ??= (async () => {
    if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) return new InMemoryCurriculumSubjectRepository();
    const collection = await getCollection<Document>("curriculum_subjects", runtime);
    await collection.createIndex({ tenantId: 1, naturalKey: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });
    return new MongoCurriculumSubjectRepository(createMongoCollectionAdapter(collection));
  })();
}
