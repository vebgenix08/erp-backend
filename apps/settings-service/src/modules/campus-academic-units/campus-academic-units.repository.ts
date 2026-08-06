import { ConflictError } from "@school-erp/errors";
import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import type { CampusAcademicUnitCreateInput, CampusAcademicUnitListFilter, CampusAcademicUnitRecord, CampusAcademicUnitUpdateInput } from "./campus-academic-units.model";

export interface CampusAcademicUnitRepository {
  list(tenantId: string, filter?: CampusAcademicUnitListFilter): Promise<CampusAcademicUnitRecord[]>;
  getById(tenantId: string, id: string): Promise<CampusAcademicUnitRecord | null>;
  create(tenantId: string, campusId: string, input: CampusAcademicUnitCreateInput): Promise<CampusAcademicUnitRecord>;
  update(tenantId: string, id: string, input: CampusAcademicUnitUpdateInput): Promise<CampusAcademicUnitRecord | null>;
}
interface Document extends CampusAcademicUnitRecord { _id: string; unitKey: string }
const unitKey = (campusId: string, type: string, affiliationId: string) => `${campusId}:${type}:${affiliationId}`.toLowerCase();
const clone = (record: CampusAcademicUnitRecord): CampusAcademicUnitRecord => ({ ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt), deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined });
const fromDocument = (document: Document | null) => { if (!document) return null; const { _id, unitKey: _, ...record } = document; return clone({ ...record, id: record.id || _id }); };
const toDocument = (record: CampusAcademicUnitRecord): Document => ({ ...clone(record), _id: record.id, unitKey: unitKey(record.campusId, record.type, record.curriculumOrAffiliationId) });

export class InMemoryCampusAcademicUnitRepository implements CampusAcademicUnitRepository {
  private readonly records = new Map<string, CampusAcademicUnitRecord>();
  async list(tenantId: string, filter: CampusAcademicUnitListFilter = {}) {
    return [...this.records.values()].filter((item) => item.tenantId === tenantId && (!filter.campusId || item.campusId === filter.campusId) && (!filter.type || item.type === filter.type) && (!filter.status || item.status === filter.status)).map(clone);
  }
  async getById(tenantId: string, id: string) { const item = this.records.get(id); return item?.tenantId === tenantId ? clone(item) : null; }
  async create(tenantId: string, campusId: string, input: CampusAcademicUnitCreateInput) {
    if ([...this.records.values()].some((item) => item.tenantId === tenantId && unitKey(item.campusId, item.type, item.curriculumOrAffiliationId) === unitKey(campusId, input.type, input.curriculumOrAffiliationId))) throw new ConflictError("academic unit already exists for this campus and affiliation");
    const id = `unit_${crypto.randomUUID()}`; const timestamp = new Date();
    const record: CampusAcademicUnitRecord = { id, tenantId, campusId, code: `UNIT-${id.slice(-6).toUpperCase()}`, ...input, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    this.records.set(id, record); return clone(record);
  }
  async update(tenantId: string, id: string, input: CampusAcademicUnitUpdateInput) {
    const current = await this.getById(tenantId, id); if (!current) return null;
    const status = input.status ?? current.status;
    const next = clone({ ...current, name: input.name ?? current.name, curriculumOrAffiliationId: input.curriculumOrAffiliationId ?? current.curriculumOrAffiliationId, status, updatedAt: new Date(), deactivatedAt: status === "INACTIVE" ? current.deactivatedAt ?? new Date() : undefined });
    this.records.set(id, next); return clone(next);
  }
}
class MongoCampusAcademicUnitRepository implements CampusAcademicUnitRepository {
  constructor(private readonly collection: CollectionAdapter<Document>) {}
  async list(tenantId: string, filter: CampusAcademicUnitListFilter = {}) {
    const query: Record<string, unknown> = { tenantId }; for (const [field, value] of Object.entries(filter)) if (value !== undefined) query[field] = value;
    return (await this.collection.findMany(query)).map(fromDocument).filter((item): item is CampusAcademicUnitRecord => Boolean(item));
  }
  async getById(tenantId: string, id: string) { return fromDocument(await this.collection.findOne({ tenantId, _id: id })); }
  async create(tenantId: string, campusId: string, input: CampusAcademicUnitCreateInput) {
    const key = unitKey(campusId, input.type, input.curriculumOrAffiliationId);
    if (await this.collection.findOne({ tenantId, unitKey: key })) throw new ConflictError("academic unit already exists for this campus and affiliation");
    const id = `unit_${crypto.randomUUID()}`; const timestamp = new Date();
    const record: CampusAcademicUnitRecord = { id, tenantId, campusId, code: `UNIT-${id.slice(-6).toUpperCase()}`, ...input, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    await this.collection.insertOne(toDocument(record)); return clone(record);
  }
  async update(tenantId: string, id: string, input: CampusAcademicUnitUpdateInput) {
    const current = await this.getById(tenantId, id); if (!current) return null; const status = input.status ?? current.status;
    const next = clone({ ...current, name: input.name ?? current.name, curriculumOrAffiliationId: input.curriculumOrAffiliationId ?? current.curriculumOrAffiliationId, status, updatedAt: new Date(), deactivatedAt: status === "INACTIVE" ? current.deactivatedAt ?? new Date() : undefined });
    await this.collection.replaceOne({ tenantId, _id: id }, toDocument(next)); return next;
  }
}
const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
export async function createCampusAcademicUnitRepository(runtime = env()): Promise<CampusAcademicUnitRepository> {
  if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST) return new InMemoryCampusAcademicUnitRepository();
  const collection = await getCollection<Document>("settings_campus_academic_units", runtime);
  await collection.createIndex({ tenantId: 1, unitKey: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, campusId: 1, status: 1 });
  return new MongoCampusAcademicUnitRepository(createMongoCollectionAdapter(collection));
}
let singleton: Promise<CampusAcademicUnitRepository> | undefined;
const getDefault = () => singleton ??= createCampusAcademicUnitRepository();
export const campusAcademicUnitRepository: CampusAcademicUnitRepository = {
  list: async (...args) => (await getDefault()).list(...args),
  getById: async (...args) => (await getDefault()).getById(...args),
  create: async (...args) => (await getDefault()).create(...args),
  update: async (...args) => (await getDefault()).update(...args),
};
