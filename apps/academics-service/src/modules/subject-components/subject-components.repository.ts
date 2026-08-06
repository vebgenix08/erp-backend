import { ConflictError } from "@school-erp/errors";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import type { SubjectComponentFilter, SubjectComponentInput, SubjectComponentRecord } from "./subject-components.model";
const clone = (r: SubjectComponentRecord): SubjectComponentRecord => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt), ...(r.deactivatedAt ? { deactivatedAt: new Date(r.deactivatedAt) } : {}) });
export interface SubjectComponentRepository {
  list(tenantId: string, filter: SubjectComponentFilter): Promise<SubjectComponentRecord[]>;
  get(tenantId: string, id: string): Promise<SubjectComponentRecord | null>;
  create(tenantId: string, actorId: string, input: SubjectComponentInput): Promise<SubjectComponentRecord>;
  deactivate(tenantId: string, actorId: string, id: string, reason: string): Promise<SubjectComponentRecord | null>;
}
export class InMemorySubjectComponentRepository implements SubjectComponentRepository {
  private records = new Map<string, SubjectComponentRecord>();
  async list(tenantId: string, filter: SubjectComponentFilter) { return [...this.records.values()].filter((r) => r.tenantId === tenantId && Object.entries(filter).every(([k, v]) => r[k as keyof SubjectComponentRecord] === v)).map(clone); }
  async get(tenantId: string, id: string) { const r = this.records.get(id); return r?.tenantId === tenantId ? clone(r) : null; }
  async create(tenantId: string, actorId: string, input: SubjectComponentInput) {
    if ([...this.records.values()].some((r) => r.tenantId === tenantId && r.curriculumSubjectId === input.curriculumSubjectId && r.componentType === input.componentType && r.status === "ACTIVE")) throw new ConflictError("active subject component already exists");
    const now = new Date(), id = `subject_component_${crypto.randomUUID()}`;
    const record: SubjectComponentRecord = { id, tenantId, ...input, workloadMultiplier: input.workloadMultiplier ?? 1, preferredSessionLength: input.preferredSessionLength ?? 1, requiresConsecutivePeriods: input.requiresConsecutivePeriods ?? false, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    this.records.set(id, record); return clone(record);
  }
  async deactivate(tenantId: string, actorId: string, id: string, reason: string) {
    const current = await this.get(tenantId, id); if (!current) return null; const now = new Date();
    const record: SubjectComponentRecord = { ...current, status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    this.records.set(id, record); return clone(record);
  }
}
interface Document extends SubjectComponentRecord { _id: string }
class MongoSubjectComponentRepository implements SubjectComponentRepository {
  constructor(private readonly collection: CollectionAdapter<Document>) {}
  private from(d: Document | null) { if (!d) return null; const { _id, ...record } = d; return clone({ ...record, id: record.id || _id }); }
  async list(tenantId: string, filter: SubjectComponentFilter) { return (await this.collection.findMany({ tenantId, ...filter })).map((d) => this.from(d)!); }
  async get(tenantId: string, id: string) { return this.from(await this.collection.findOne({ tenantId, _id: id })); }
  async create(tenantId: string, actorId: string, input: SubjectComponentInput) {
    if (await this.collection.findOne({ tenantId, curriculumSubjectId: input.curriculumSubjectId, componentType: input.componentType, status: "ACTIVE" })) throw new ConflictError("active subject component already exists");
    const now = new Date(), id = `subject_component_${crypto.randomUUID()}`;
    const record: SubjectComponentRecord = { id, tenantId, ...input, workloadMultiplier: input.workloadMultiplier ?? 1, preferredSessionLength: input.preferredSessionLength ?? 1, requiresConsecutivePeriods: input.requiresConsecutivePeriods ?? false, status: "ACTIVE", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    await this.collection.insertOne({ ...record, _id: id }); return clone(record);
  }
  async deactivate(tenantId: string, actorId: string, id: string, reason: string) {
    const current = await this.get(tenantId, id); if (!current) return null; const now = new Date();
    const next: SubjectComponentRecord = { ...current, status: "INACTIVE", deactivatedAt: now, deactivatedBy: actorId, deactivationReason: reason, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    const replaced = await this.collection.replaceOne({ tenantId, _id: id, version: current.version }, { ...next, _id: id });
    if (!replaced) throw new ConflictError("subject component was changed by another request"); return clone(next);
  }
}
const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: Promise<SubjectComponentRepository> | undefined;
export function subjectComponentRepository(runtime: MongoEnvLike = env()) {
  return singleton ??= (async () => {
    if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) return new InMemorySubjectComponentRepository();
    const collection = await getCollection<Document>("subject_components", runtime);
    await collection.createIndex({ tenantId: 1, curriculumSubjectId: 1, componentType: 1, status: 1 });
    return new MongoSubjectComponentRepository(createMongoCollectionAdapter(collection));
  })();
}
