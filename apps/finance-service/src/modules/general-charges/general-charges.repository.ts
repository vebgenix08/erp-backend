import { BadRequestError } from "@school-erp/errors";
import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import type { Collection } from "mongodb";
import type { CreateGeneralChargeInput, GeneralChargeFilter, GeneralChargeRecord } from "./general-charges.model";

interface Document extends GeneralChargeRecord { _id: string }

export interface GeneralChargeRepository {
  reserve(tenantId: string, actorId: string, feeHeadCode: string, input: CreateGeneralChargeInput): Promise<GeneralChargeRecord>;
  update(tenantId: string, record: GeneralChargeRecord): Promise<GeneralChargeRecord>;
  list(tenantId: string, filter?: GeneralChargeFilter): Promise<GeneralChargeRecord[]>;
}

const tenant = (value: string) => {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError("tenantId is required");
  return normalized;
};
const clone = (record: GeneralChargeRecord): GeneralChargeRecord => ({
  ...record,
  target: { ...record.target, ids: [...record.target.ids] },
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});
const recordFor = (tenantId: string, actorId: string, feeHeadCode: string, input: CreateGeneralChargeInput): GeneralChargeRecord => {
  const now = new Date();
  return {
    ...input,
    id: `general_charge_${crypto.randomUUID()}`,
    tenantId,
    feeHeadCode,
    status: "ASSIGNING",
    assignedCount: 0,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
};
const matches = (record: GeneralChargeRecord, filter: GeneralChargeFilter) =>
  (!filter.campusId || record.campusId === filter.campusId) &&
  (!filter.academicYearId || record.academicYearId === filter.academicYearId) &&
  (!filter.status || record.status === filter.status);

export class InMemoryGeneralChargeRepository implements GeneralChargeRepository {
  private readonly records = new Map<string, GeneralChargeRecord>();
  async reserve(tenantId: string, actorId: string, feeHeadCode: string, input: CreateGeneralChargeInput) {
    const id = tenant(tenantId);
    const existing = [...this.records.values()].find((item) => item.tenantId === id && item.idempotencyKey === input.idempotencyKey);
    if (existing) return clone(existing);
    const record = recordFor(id, actorId, feeHeadCode, input);
    this.records.set(record.id, clone(record));
    return clone(record);
  }
  async update(tenantId: string, record: GeneralChargeRecord) {
    if (record.tenantId !== tenant(tenantId) || !this.records.has(record.id))
      throw new BadRequestError("general charge was not found");
    this.records.set(record.id, clone(record));
    return clone(record);
  }
  async list(tenantId: string, filter: GeneralChargeFilter = {}) {
    const id = tenant(tenantId);
    return [...this.records.values()].filter((item) => item.tenantId === id && matches(item, filter)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(clone);
  }
}

class MongoGeneralChargeRepository implements GeneralChargeRepository {
  constructor(private readonly collection: Collection<Document>) {}
  async reserve(tenantId: string, actorId: string, feeHeadCode: string, input: CreateGeneralChargeInput) {
    const id = tenant(tenantId);
    const existing = await this.collection.findOne({ tenantId: id, idempotencyKey: input.idempotencyKey });
    if (existing) return clone(existing);
    const record = recordFor(id, actorId, feeHeadCode, input);
    try { await this.collection.insertOne({ ...record, _id: record.id } as Document); }
    catch (error) {
      const current = await this.collection.findOne({ tenantId: id, idempotencyKey: input.idempotencyKey });
      if (current) return clone(current);
      throw error;
    }
    return clone(record);
  }
  async update(tenantId: string, record: GeneralChargeRecord) {
    const result = await this.collection.replaceOne(
      { tenantId: tenant(tenantId), _id: record.id },
      { ...record, _id: record.id } as Document,
    );
    if (result.modifiedCount !== 1) throw new BadRequestError("general charge was not found");
    return clone(record);
  }
  async list(tenantId: string, filter: GeneralChargeFilter = {}) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    if (filter.campusId) query.campusId = filter.campusId;
    if (filter.academicYearId) query.academicYearId = filter.academicYearId;
    if (filter.status) query.status = filter.status;
    return (await this.collection.find(query).sort({ createdAt: -1 }).toArray()).map(clone);
  }
}

const env = (): MongoEnvLike => (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};
let singleton: Promise<GeneralChargeRepository> | undefined;
export function generalChargeRepository(): Promise<GeneralChargeRepository> {
  singleton ??= (async () => {
    const runtime = env();
    if (!runtime.MONGODB_URI && !runtime.MONGODB_URI_DEV && !runtime.MONGODB_URI_PROD && !runtime.MONGODB_URI_TEST)
      return new InMemoryGeneralChargeRepository();
    const connection = await getMongoConnection(runtime);
    const collection = connection.client.db(connection.dbName).collection<Document>("finance_general_charges");
    await collection.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
    await collection.createIndex({ tenantId: 1, campusId: 1, academicYearId: 1, createdAt: -1 });
    return new MongoGeneralChargeRepository(collection);
  })();
  return singleton;
}
