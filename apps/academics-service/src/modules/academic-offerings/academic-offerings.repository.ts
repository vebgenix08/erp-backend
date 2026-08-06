import { BadRequestError, ConflictError } from "@school-erp/errors";
import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { AcademicOfferingCreateInput, AcademicOfferingListFilter, AcademicOfferingRecord, AcademicOfferingUpdateInput } from "./academic-offerings.model";

export interface AcademicOfferingRepository {
  list(tenantId: string, filter: AcademicOfferingListFilter): Promise<AcademicOfferingRecord[]>;
  getById(tenantId: string, id: string): Promise<AcademicOfferingRecord | null>;
  create(tenantId: string, input: AcademicOfferingCreateInput): Promise<AcademicOfferingRecord>;
  update(tenantId: string, id: string, input: AcademicOfferingUpdateInput): Promise<AcademicOfferingRecord | null>;
  deactivate(tenantId: string, id: string): Promise<AcademicOfferingRecord | null>;
}
interface Document extends AcademicOfferingRecord { _id: string; offeringKey: string }
const tenant = (value: string) => { const id = value.trim(); if (!id) throw new BadRequestError("tenantId is required"); return id; };
const key = (input: Pick<AcademicOfferingRecord, "campusId" | "academicYearId" | "curriculumId" | "programId" | "classId" | "sectionId">) =>
  [input.campusId, input.academicYearId, input.curriculumId, input.programId, input.classId, input.sectionId ?? "-"].join(":");
const clone = (record: AcademicOfferingRecord): AcademicOfferingRecord => ({ ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt), deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined });
const fromDocument = (document: Document | null) => {
  if (!document) return null;
  const { _id, offeringKey: _, ...record } = document;
  return clone({ ...record, id: record.id || _id });
};
const toDocument = (record: AcademicOfferingRecord): Document => ({ ...clone(record), _id: record.id, offeringKey: key(record) });

export class InMemoryAcademicOfferingRepository implements AcademicOfferingRepository {
  private readonly records = new Map<string, Map<string, AcademicOfferingRecord>>();
  private bucket(tenantId: string) { const id = tenant(tenantId); let value = this.records.get(id); if (!value) { value = new Map(); this.records.set(id, value); } return value; }
  async list(tenantId: string, filter: AcademicOfferingListFilter) {
    return [...this.bucket(tenantId).values()].filter((item) => Object.entries(filter).every(([field, value]) => !value || item[field as keyof AcademicOfferingRecord] === value)).map(clone);
  }
  async getById(tenantId: string, id: string) { const record = this.bucket(tenantId).get(id); return record ? clone(record) : null; }
  async create(tenantId: string, input: AcademicOfferingCreateInput) {
    const bucket = this.bucket(tenantId);
    if ([...bucket.values()].some((item) => key(item) === key(input as AcademicOfferingRecord))) throw new ConflictError("academic offering already exists");
    const timestamp = new Date(); const record: AcademicOfferingRecord = { id: `offering_${crypto.randomUUID()}`, tenantId: tenant(tenantId), ...input, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    bucket.set(record.id, record); return clone(record);
  }
  async update(tenantId: string, id: string, input: AcademicOfferingUpdateInput) {
    const bucket = this.bucket(tenantId); const current = bucket.get(id); if (!current) return null;
    const status = input.status ?? current.status; const next = clone({ ...current, ...input, status, updatedAt: new Date(), deactivatedAt: status === "INACTIVE" ? current.deactivatedAt ?? new Date() : undefined });
    if ([...bucket.values()].some((item) => item.id !== id && key(item) === key(next))) throw new ConflictError("academic offering already exists");
    bucket.set(id, next); return clone(next);
  }
  async deactivate(tenantId: string, id: string) { return this.update(tenantId, id, { status: "INACTIVE" }); }
}
class MongoAcademicOfferingRepository implements AcademicOfferingRepository {
  constructor(private readonly collection: CollectionAdapter<Document>) {}
  async list(tenantId: string, filter: AcademicOfferingListFilter) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    for (const [field, value] of Object.entries(filter)) {
      if (value !== undefined) query[field] = value;
    }
    return (await this.collection.findMany(query)).map(fromDocument).filter((item): item is AcademicOfferingRecord => Boolean(item));
  }
  async getById(tenantId: string, id: string) { return fromDocument(await this.collection.findOne({ tenantId: tenant(tenantId), _id: id })); }
  async create(tenantId: string, input: AcademicOfferingCreateInput) {
    const normalizedTenant = tenant(tenantId); const offeringKey = key(input as AcademicOfferingRecord);
    if (await this.collection.findOne({ tenantId: normalizedTenant, offeringKey })) throw new ConflictError("academic offering already exists");
    const timestamp = new Date(); const record: AcademicOfferingRecord = { id: `offering_${crypto.randomUUID()}`, tenantId: normalizedTenant, ...input, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp };
    await this.collection.insertOne(toDocument(record)); return clone(record);
  }
  async update(tenantId: string, id: string, input: AcademicOfferingUpdateInput) {
    const current = await this.getById(tenantId, id); if (!current) return null;
    const status = input.status ?? current.status; const next = clone({ ...current, ...input, status, updatedAt: new Date(), deactivatedAt: status === "INACTIVE" ? current.deactivatedAt ?? new Date() : undefined });
    const duplicate = await this.collection.findOne({ tenantId: tenant(tenantId), offeringKey: key(next) });
    if (duplicate && duplicate.id !== id) throw new ConflictError("academic offering already exists");
    await this.collection.replaceOne({ tenantId: tenant(tenantId), _id: id }, toDocument(next)); return next;
  }
  async deactivate(tenantId: string, id: string) { return this.update(tenantId, id, { status: "INACTIVE" }); }
}
const runtimeEnv = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
const hasMongo = (env: MongoEnvLike) => Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
export async function createAcademicOfferingRepository(env: MongoEnvLike = runtimeEnv()): Promise<AcademicOfferingRepository> {
  if (!hasMongo(env)) return new InMemoryAcademicOfferingRepository();
  const collection = await getCollection<Document>("academics_academic_offerings", env);
  await collection.createIndex({ tenantId: 1, offeringKey: 1 }, { unique: true });
  await collection.createIndex({ tenantId: 1, campusId: 1, academicYearId: 1, status: 1 });
  return new MongoAcademicOfferingRepository(createMongoCollectionAdapter(collection));
}
let defaultRepository: Promise<AcademicOfferingRepository> | undefined;
const getDefault = () => defaultRepository ??= createAcademicOfferingRepository();
export const academicOfferingRepository: AcademicOfferingRepository = {
  list: async (...args) => (await getDefault()).list(...args),
  getById: async (...args) => (await getDefault()).getById(...args),
  create: async (...args) => (await getDefault()).create(...args),
  update: async (...args) => (await getDefault()).update(...args),
  deactivate: async (...args) => (await getDefault()).deactivate(...args),
};
