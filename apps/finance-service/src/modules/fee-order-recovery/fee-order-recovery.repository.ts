import { BadRequestError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import type { StudentEnrolledEventData } from "@school-erp/events";
import type {
  FeeOrderRecoveryFilter,
  FeeOrderRecoveryRecord,
} from "./fee-order-recovery.model";
interface Document extends Record<string, unknown> {
  _id: string;
  tenantId: string;
  record: FeeOrderRecoveryRecord;
}
const tenant = (value: string) => {
  const result = value.trim();
  if (!result) throw new BadRequestError("tenantId is required");
  return result;
};
const clone = (record: FeeOrderRecoveryRecord): FeeOrderRecoveryRecord => ({
  ...record,
  payload: { ...record.payload },
  lastAttemptAt: new Date(record.lastAttemptAt),
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
  ...(record.resolvedAt ? { resolvedAt: new Date(record.resolvedAt) } : {}),
});
export interface FeeOrderRecoveryRepository {
  recordFailure(
    tenantId: string,
    eventId: string,
    payload: StudentEnrolledEventData,
    error: string,
    at: Date,
  ): Promise<FeeOrderRecoveryRecord>;
  getById(tenantId: string, id: string): Promise<FeeOrderRecoveryRecord | null>;
  list(
    tenantId: string,
    filter?: FeeOrderRecoveryFilter,
  ): Promise<FeeOrderRecoveryRecord[]>;
  resolve(
    tenantId: string,
    id: string,
    actorId: string,
    at: Date,
  ): Promise<FeeOrderRecoveryRecord | null>;
}
abstract class BaseRepository implements FeeOrderRecoveryRepository {
  protected abstract documents(tenantId: string): Promise<Document[]>;
  protected abstract find(
    tenantId: string,
    id: string,
  ): Promise<Document | null>;
  protected abstract findByEvent(
    tenantId: string,
    eventId: string,
  ): Promise<Document | null>;
  protected abstract save(document: Document): Promise<void>;
  protected abstract replace(document: Document): Promise<boolean>;
  async recordFailure(
    tenantId: string,
    eventId: string,
    payload: StudentEnrolledEventData,
    error: string,
    at: Date,
  ) {
    const owner = tenant(tenantId),
      existing = await this.findByEvent(owner, eventId);
    const record: FeeOrderRecoveryRecord = existing
      ? {
          ...existing.record,
          status: "PENDING",
          attempts: existing.record.attempts + 1,
          lastError: error,
          lastAttemptAt: at,
          updatedAt: at,
        }
      : {
          id: `fee_order_recovery_${crypto.randomUUID()}`,
          tenantId: owner,
          eventId,
          studentId: payload.studentId,
          studentName: payload.studentName,
          registrationNumber: payload.registrationNumber,
          campusId: payload.campusId,
          academicYearId: payload.academicYearId,
          payload: { ...payload },
          status: "PENDING",
          attempts: 1,
          lastError: error,
          lastAttemptAt: at,
          createdAt: at,
          updatedAt: at,
        };
    const document = { _id: record.id, tenantId: owner, record };
    if (existing) await this.replace(document);
    else await this.save(document);
    return clone(record);
  }
  async getById(tenantId: string, id: string) {
    const document = await this.find(tenant(tenantId), id);
    return document ? clone(document.record) : null;
  }
  async list(tenantId: string, filter: FeeOrderRecoveryFilter = {}) {
    return (await this.documents(tenant(tenantId)))
      .map((item) => item.record)
      .filter(
        (item) =>
          (!filter.campusId || item.campusId === filter.campusId) &&
          (!filter.academicYearId ||
            item.academicYearId === filter.academicYearId) &&
          (!filter.status || item.status === filter.status) &&
          (!filter.search ||
            `${item.studentName} ${item.registrationNumber} ${item.lastError}`
              .toLowerCase()
              .includes(filter.search.toLowerCase())),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(clone);
  }
  async resolve(tenantId: string, id: string, actorId: string, at: Date) {
    const document = await this.find(tenant(tenantId), id);
    if (!document) return null;
    document.record = {
      ...document.record,
      status: "RESOLVED",
      resolvedAt: at,
      resolvedBy: actorId,
      updatedAt: at,
    };
    await this.replace(document);
    return clone(document.record);
  }
}
export class InMemoryFeeOrderRecoveryRepository extends BaseRepository {
  private readonly store = new Map<string, Document>();
  protected async documents(tenantId: string) {
    return [...this.store.values()]
      .filter((item) => item.tenantId === tenantId)
      .map((item) => ({ ...item, record: clone(item.record) }));
  }
  protected async find(tenantId: string, id: string) {
    const item = this.store.get(id);
    return item?.tenantId === tenantId
      ? { ...item, record: clone(item.record) }
      : null;
  }
  protected async findByEvent(tenantId: string, eventId: string) {
    return (
      [...this.store.values()].find(
        (item) => item.tenantId === tenantId && item.record.eventId === eventId,
      ) ?? null
    );
  }
  protected async save(document: Document) {
    this.store.set(document._id, {
      ...document,
      record: clone(document.record),
    });
  }
  protected async replace(document: Document) {
    if (!this.store.has(document._id)) return false;
    await this.save(document);
    return true;
  }
}
class MongoRepository extends BaseRepository {
  constructor(private readonly collection: CollectionAdapter<Document>) {
    super();
  }
  protected async documents(tenantId: string) {
    return this.collection.findMany({ tenantId });
  }
  protected async find(tenantId: string, id: string) {
    return this.collection.findOne({ tenantId, _id: id });
  }
  protected async findByEvent(tenantId: string, eventId: string) {
    return this.collection.findOne({ tenantId, "record.eventId": eventId });
  }
  protected async save(document: Document) {
    await this.collection.insertOne(document);
  }
  protected async replace(document: Document) {
    return Boolean(
      await this.collection.replaceOne(
        { tenantId: document.tenantId, _id: document._id },
        document,
      ),
    );
  }
}
function env(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
function hasMongo(value: MongoEnvLike) {
  return Boolean(
    value.MONGODB_URI ||
      value.MONGODB_URI_DEV ||
      value.MONGODB_URI_PROD ||
      value.MONGODB_URI_TEST,
  );
}
export async function createFeeOrderRecoveryRepository(
  value: MongoEnvLike = env(),
): Promise<FeeOrderRecoveryRepository> {
  if (!hasMongo(value)) return new InMemoryFeeOrderRecoveryRepository();
  const collection = await getCollection<Document>(
    "finance_fee_order_recoveries",
    value,
  );
  await collection.createIndex(
    { tenantId: 1, "record.eventId": 1 },
    { unique: true },
  );
  await collection.createIndex({
    tenantId: 1,
    "record.status": 1,
    "record.updatedAt": -1,
  });
  return new MongoRepository(createMongoCollectionAdapter(collection));
}
let singleton: Promise<FeeOrderRecoveryRepository> | undefined;
export function feeOrderRecoveryRepository() {
  singleton ??= createFeeOrderRecoveryRepository();
  return singleton;
}
