import { ConflictError } from "@school-erp/errors";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import type { AcademicYearSubjectPlanFilter, AcademicYearSubjectPlanInput, AcademicYearSubjectPlanRecord } from "./academic-year-subject-plans.model";
const clone = (r: AcademicYearSubjectPlanRecord): AcademicYearSubjectPlanRecord => ({ ...r, componentPlans: r.componentPlans.map((p) => ({ ...p })), createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt), ...(r.activatedAt ? { activatedAt: new Date(r.activatedAt) } : {}), ...(r.closedAt ? { closedAt: new Date(r.closedAt) } : {}) });
export interface AcademicYearSubjectPlanRepository {
  list(tenantId: string, filter: AcademicYearSubjectPlanFilter): Promise<AcademicYearSubjectPlanRecord[]>;
  get(tenantId: string, id: string): Promise<AcademicYearSubjectPlanRecord | null>;
  create(tenantId: string, actorId: string, input: AcademicYearSubjectPlanInput): Promise<AcademicYearSubjectPlanRecord>;
  activate(tenantId: string, actorId: string, id: string): Promise<AcademicYearSubjectPlanRecord | null>;
}
export class InMemoryAcademicYearSubjectPlanRepository implements AcademicYearSubjectPlanRepository {
  private records = new Map<string, AcademicYearSubjectPlanRecord>();
  async list(tenantId: string, filter: AcademicYearSubjectPlanFilter) { return [...this.records.values()].filter((r) => r.tenantId === tenantId && Object.entries(filter).every(([k, v]) => r[k as keyof AcademicYearSubjectPlanRecord] === v)).map(clone); }
  async get(tenantId: string, id: string) { const r = this.records.get(id); return r?.tenantId === tenantId ? clone(r) : null; }
  async create(tenantId: string, actorId: string, input: AcademicYearSubjectPlanInput) {
    if (!input.componentPlans.length) throw new ConflictError("subject plan requires at least one component plan");
    if (new Set(input.componentPlans.map((p) => p.subjectComponentId)).size !== input.componentPlans.length) throw new ConflictError("subject component cannot appear twice in one plan");
    const duplicate = [...this.records.values()].some((r) => r.tenantId === tenantId && r.campusId === input.campusId && r.academicYearId === input.academicYearId && r.curriculumSubjectId === input.curriculumSubjectId && r.status !== "CLOSED");
    if (duplicate) throw new ConflictError("open academic-year subject plan already exists");
    const now = new Date(), record: AcademicYearSubjectPlanRecord = { id: `subject_plan_${crypto.randomUUID()}`, tenantId, ...input, componentPlans: input.componentPlans.map((p) => ({ ...p })), status: "DRAFT", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    this.records.set(record.id, record); return clone(record);
  }
  async activate(tenantId: string, actorId: string, id: string) {
    const current = await this.get(tenantId, id); if (!current) return null;
    if (current.status !== "DRAFT") throw new ConflictError("only a draft subject plan can be activated");
    const now = new Date(), record: AcademicYearSubjectPlanRecord = { ...current, status: "ACTIVE", activatedAt: now, activatedBy: actorId, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    this.records.set(id, record); return clone(record);
  }
}
interface Document extends AcademicYearSubjectPlanRecord { _id: string }
class MongoAcademicYearSubjectPlanRepository implements AcademicYearSubjectPlanRepository {
  constructor(private readonly collection: CollectionAdapter<Document>) {}
  private from(d: Document | null) { if (!d) return null; const { _id, ...record } = d; return clone({ ...record, id: record.id || _id }); }
  async list(tenantId: string, filter: AcademicYearSubjectPlanFilter) { return (await this.collection.findMany({ tenantId, ...filter })).map((d) => this.from(d)!); }
  async get(tenantId: string, id: string) { return this.from(await this.collection.findOne({ tenantId, _id: id })); }
  async create(tenantId: string, actorId: string, input: AcademicYearSubjectPlanInput) {
    if (!input.componentPlans.length) throw new ConflictError("subject plan requires at least one component plan");
    if (new Set(input.componentPlans.map((p) => p.subjectComponentId)).size !== input.componentPlans.length) throw new ConflictError("subject component cannot appear twice in one plan");
    if (await this.collection.findOne({ tenantId, campusId: input.campusId, academicYearId: input.academicYearId, curriculumSubjectId: input.curriculumSubjectId, status: { $ne: "CLOSED" } })) throw new ConflictError("open academic-year subject plan already exists");
    const now = new Date(), id = `subject_plan_${crypto.randomUUID()}`;
    const record: AcademicYearSubjectPlanRecord = { id, tenantId, ...input, componentPlans: input.componentPlans.map((p) => ({ ...p })), status: "DRAFT", createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, version: 1 };
    await this.collection.insertOne({ ...record, _id: id }); return clone(record);
  }
  async activate(tenantId: string, actorId: string, id: string) {
    const current = await this.get(tenantId, id); if (!current) return null;
    if (current.status !== "DRAFT") throw new ConflictError("only a draft subject plan can be activated");
    const now = new Date(), next: AcademicYearSubjectPlanRecord = { ...current, status: "ACTIVE", activatedAt: now, activatedBy: actorId, updatedAt: now, updatedBy: actorId, version: current.version + 1 };
    const replaced = await this.collection.replaceOne({ tenantId, _id: id, version: current.version }, { ...next, _id: id });
    if (!replaced) throw new ConflictError("subject plan was changed by another request"); return clone(next);
  }
}
const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: Promise<AcademicYearSubjectPlanRepository> | undefined;
export function academicYearSubjectPlanRepository(runtime: MongoEnvLike = env()) {
  return singleton ??= (async () => {
    if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) return new InMemoryAcademicYearSubjectPlanRepository();
    const collection = await getCollection<Document>("academic_year_subject_plans", runtime);
    await collection.createIndex({ tenantId: 1, campusId: 1, academicYearId: 1, curriculumSubjectId: 1, status: 1 });
    return new MongoAcademicYearSubjectPlanRepository(createMongoCollectionAdapter(collection));
  })();
}
