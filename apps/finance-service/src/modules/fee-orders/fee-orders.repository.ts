import { BadRequestError, ConflictError } from "@school-erp/errors";
import {
  createMongoCollectionAdapter,
  getCollection,
  type CollectionAdapter,
  type MongoEnvLike,
} from "@school-erp/mongodb";
import { issueConfiguredNumber } from "@school-erp/numbering";
import type { FeeOrderFilter, FeeOrderPage, FeeOrderRecord } from "./fee-orders.model";

interface FeeOrderDocument extends Record<string, unknown> {
  _id: string;
  tenantId: string;
  record: FeeOrderRecord;
}
export type FeeOrderCreateInput = Omit<
  FeeOrderRecord,
  "id" | "tenantId" | "orderNumber" | "sourceType" | "sourceId"
> &
  Partial<Pick<FeeOrderRecord, "sourceType" | "sourceId">>;

export interface FeeOrderRepository {
  create(
    tenantId: string,
    record: FeeOrderCreateInput,
  ): Promise<FeeOrderRecord>;
  getById(tenantId: string, id: string): Promise<FeeOrderRecord | null>;
  getByEnrollmentId(
    tenantId: string,
    enrollmentId: string,
  ): Promise<FeeOrderRecord | null>;
  getByStudentAcademicYear(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<FeeOrderRecord | null>;
  getBySourceStudent(
    tenantId: string,
    sourceType: FeeOrderRecord["sourceType"],
    sourceId: string,
    studentId: string,
  ): Promise<FeeOrderRecord | null>;
  list(tenantId: string, filter?: FeeOrderFilter): Promise<FeeOrderRecord[]>;
  listPage(tenantId: string, filter?: FeeOrderFilter): Promise<FeeOrderPage>;
  replace(
    tenantId: string,
    record: FeeOrderRecord,
  ): Promise<FeeOrderRecord | null>;
}

function tenant(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError("tenantId is required");
  return normalized;
}
function clone(record: FeeOrderRecord): FeeOrderRecord {
  const copy: FeeOrderRecord = {
    ...record,
    sourceType: record.sourceType ?? "ANNUAL",
    sourceId: record.sourceId ?? record.enrollmentId,
    charges: record.charges.map((item) => ({ ...item })),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
  if (record.closedAt) copy.closedAt = new Date(record.closedAt);
  return copy;
}
function matches(record: FeeOrderRecord, filter: FeeOrderFilter) {
  if (filter.campusId && record.campusId !== filter.campusId) return false;
  if (filter.academicYearId && record.academicYearId !== filter.academicYearId)
    return false;
  if (filter.studentId && record.studentId !== filter.studentId) return false;
  if (filter.classId && record.classId !== filter.classId) return false;
  if (filter.sectionId && record.sectionId !== filter.sectionId) return false;
  if (filter.status && record.status !== filter.status) return false;
  if (filter.sourceType && (record.sourceType ?? "ANNUAL") !== filter.sourceType)
    return false;
  if (
    filter.search &&
    !`${record.studentName} ${record.registrationNumber} ${record.orderNumber}`
      .toLowerCase()
      .includes(filter.search.toLowerCase())
  )
    return false;
  return true;
}

export class InMemoryFeeOrderRepository implements FeeOrderRepository {
  private readonly records = new Map<string, FeeOrderRecord>();
  private readonly sequences = new Map<string, number>();
  async create(
    tenantId: string,
    input: FeeOrderCreateInput,
  ) {
    const normalizedTenant = tenant(tenantId);
    const existing = await this.getBySourceStudent(
      normalizedTenant,
      input.sourceType ?? "ANNUAL",
      input.sourceId ?? input.enrollmentId,
      input.studentId,
    );
    if (existing) return existing;
    const key = `${normalizedTenant}:${input.academicYearId}`;
    const sequence = (this.sequences.get(key) ?? 0) + 1;
    this.sequences.set(key, sequence);
    const record: FeeOrderRecord = {
      ...input,
      sourceType: input.sourceType ?? "ANNUAL",
      sourceId: input.sourceId ?? input.enrollmentId,
      id: `fee_order_${crypto.randomUUID()}`,
      tenantId: normalizedTenant,
      orderNumber: `FEE-${input.academicYearId
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(-8)
        .toUpperCase()}-${String(sequence).padStart(6, "0")}`,
    };
    this.records.set(record.id, clone(record));
    return clone(record);
  }
  async getById(tenantId: string, id: string) {
    const record = this.records.get(id);
    return record?.tenantId === tenant(tenantId) ? clone(record) : null;
  }
  async getByEnrollmentId(tenantId: string, enrollmentId: string) {
    const normalizedTenant = tenant(tenantId);
    const record = [...this.records.values()].find(
      (item) =>
        item.tenantId === normalizedTenant &&
        item.enrollmentId === enrollmentId,
    );
    return record ? clone(record) : null;
  }
  async getByStudentAcademicYear(tenantId: string, studentId: string, academicYearId: string) {
    const normalizedTenant = tenant(tenantId);
    const record = [...this.records.values()].find((item) => item.tenantId === normalizedTenant && item.studentId === studentId && item.academicYearId === academicYearId && (item.sourceType ?? "ANNUAL") === "ANNUAL");
    return record ? clone(record) : null;
  }
  async getBySourceStudent(tenantId: string, sourceType: FeeOrderRecord["sourceType"], sourceId: string, studentId: string) {
    const normalizedTenant = tenant(tenantId);
    const record = [...this.records.values()].find((item) => item.tenantId === normalizedTenant && (item.sourceType ?? "ANNUAL") === sourceType && (item.sourceId ?? item.enrollmentId) === sourceId && item.studentId === studentId);
    return record ? clone(record) : null;
  }
  async list(tenantId: string, filter: FeeOrderFilter = {}) {
    return [...this.records.values()]
      .filter(
        (item) => item.tenantId === tenant(tenantId) && matches(item, filter),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clone);
  }
  async listPage(tenantId: string, filter: FeeOrderFilter = {}) {
    const rows = [...this.records.values()]
      .filter(
        (item) => item.tenantId === tenant(tenantId) && matches(item, filter),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 25;
    return { items: rows.slice(offset, offset + limit).map(clone), total: rows.length, limit, offset };
  }
  async replace(tenantId: string, record: FeeOrderRecord) {
    const normalizedTenant = tenant(tenantId);
    if (record.tenantId !== normalizedTenant || !this.records.has(record.id))
      return null;
    this.records.set(record.id, clone(record));
    return clone(record);
  }
}

class MongoFeeOrderRepository implements FeeOrderRepository {
  constructor(
    private readonly orders: CollectionAdapter<FeeOrderDocument>,
    private readonly env: MongoEnvLike,
  ) {}
  async create(
    tenantId: string,
    input: FeeOrderCreateInput,
  ) {
    const normalizedTenant = tenant(tenantId);
    const existing = await this.getBySourceStudent(
      normalizedTenant,
      input.sourceType ?? "ANNUAL",
      input.sourceId ?? input.enrollmentId,
      input.studentId,
    );
    if (existing) return existing;
    const id = `fee_order_${crypto.randomUUID()}`;
    const orderNumber = await issueConfiguredNumber({
      tenantId: normalizedTenant,
      stream: "FEE_ORDER",
      idempotencyKey: id,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      programId: input.programId,
      classId: input.classId,
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    }, this.env);
    const record: FeeOrderRecord = {
      ...input,
      sourceType: input.sourceType ?? "ANNUAL",
      sourceId: input.sourceId ?? input.enrollmentId,
      id,
      tenantId: normalizedTenant,
      orderNumber,
    };
    try {
      await this.orders.insertOne({
        _id: record.id,
        tenantId: normalizedTenant,
        record: clone(record),
      });
    } catch (error) {
      const current = await this.getBySourceStudent(
        normalizedTenant,
        input.sourceType ?? "ANNUAL",
        input.sourceId ?? input.enrollmentId,
        input.studentId,
      );
      if (current) return current;
      throw new ConflictError("fee order could not be created", {
        cause: error,
      });
    }
    return clone(record);
  }
  async getById(tenantId: string, id: string) {
    const document = await this.orders.findOne({
      tenantId: tenant(tenantId),
      _id: id,
    });
    return document ? clone(document.record) : null;
  }
  async getByEnrollmentId(tenantId: string, enrollmentId: string) {
    const document = await this.orders.findOne({
      tenantId: tenant(tenantId),
      "record.enrollmentId": enrollmentId,
    });
    return document ? clone(document.record) : null;
  }
  async getByStudentAcademicYear(tenantId: string, studentId: string, academicYearId: string) {
    const document = await this.orders.findOne({ tenantId: tenant(tenantId), "record.studentId": studentId, "record.academicYearId": academicYearId, $or: [{ "record.sourceType": "ANNUAL" }, { "record.sourceType": { $exists: false } }] });
    return document ? clone(document.record) : null;
  }
  async getBySourceStudent(tenantId: string, sourceType: FeeOrderRecord["sourceType"], sourceId: string, studentId: string) {
    const document = await this.orders.findOne({ tenantId: tenant(tenantId), "record.sourceType": sourceType, "record.sourceId": sourceId, "record.studentId": studentId });
    return document ? clone(document.record) : null;
  }
  async list(tenantId: string, filter: FeeOrderFilter = {}) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    if (filter.campusId) query["record.campusId"] = filter.campusId;
    if (filter.academicYearId) query["record.academicYearId"] = filter.academicYearId;
    if (filter.studentId) query["record.studentId"] = filter.studentId;
    if (filter.classId) query["record.classId"] = filter.classId;
    if (filter.sectionId) query["record.sectionId"] = filter.sectionId;
    if (filter.status) query["record.status"] = filter.status;
    if (filter.sourceType) query["record.sourceType"] = filter.sourceType;
    if (filter.search)
      query.$or = [
        { "record.studentName": { $regex: filter.search, $options: "i" } },
        { "record.registrationNumber": { $regex: filter.search, $options: "i" } },
        { "record.orderNumber": { $regex: filter.search, $options: "i" } },
      ];
    return (await this.orders.findMany(query, { sort: { "record.createdAt": -1 } }))
      .map((item) => clone(item.record));
  }
  async listPage(tenantId: string, filter: FeeOrderFilter = {}) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    if (filter.campusId) query["record.campusId"] = filter.campusId;
    if (filter.academicYearId)
      query["record.academicYearId"] = filter.academicYearId;
    if (filter.studentId) query["record.studentId"] = filter.studentId;
    if (filter.classId) query["record.classId"] = filter.classId;
    if (filter.sectionId) query["record.sectionId"] = filter.sectionId;
    if (filter.status) query["record.status"] = filter.status;
    if (filter.sourceType) query["record.sourceType"] = filter.sourceType;
    if (filter.search)
      query.$or = [
        { "record.studentName": { $regex: filter.search, $options: "i" } },
        {
          "record.registrationNumber": { $regex: filter.search, $options: "i" },
        },
        { "record.orderNumber": { $regex: filter.search, $options: "i" } },
      ];
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 25;
    const [documents, total] = await Promise.all([
      this.orders.findMany(query, { sort: { "record.createdAt": -1 }, skip: offset, limit }),
      this.orders.count(query),
    ]);
    return { items: documents.map((item) => clone(item.record)), total, limit, offset };
  }
  async replace(tenantId: string, record: FeeOrderRecord) {
    const normalizedTenant = tenant(tenantId);
    if (record.tenantId !== normalizedTenant) return null;
    return (await this.orders.replaceOne(
      { tenantId: normalizedTenant, _id: record.id },
      { _id: record.id, tenantId: normalizedTenant, record: clone(record) },
    ))
      ? clone(record)
      : null;
  }
}

function runtimeEnv(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
function hasMongo(env: MongoEnvLike) {
  return Boolean(
    env.MONGODB_URI ||
      env.MONGODB_URI_DEV ||
      env.MONGODB_URI_PROD ||
      env.MONGODB_URI_TEST,
  );
}
export async function createFeeOrderRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<FeeOrderRepository> {
  if (!hasMongo(env)) return new InMemoryFeeOrderRepository();
  const orders = await getCollection<FeeOrderDocument>(
    "finance_fee_orders",
    env,
  );
  await orders.createIndex(
    { tenantId: 1, "record.enrollmentId": 1 },
    { unique: true },
  );
  await orders.createIndex(
    { tenantId: 1, "record.orderNumber": 1 },
    { unique: true },
  );
  await orders.dropIndex("tenantId_1_record.studentId_1_record.academicYearId_1").catch(() => undefined);
  await orders.dropIndex("uq_student_annual_fee_order").catch(() => undefined);
  await orders.createIndex({
    tenantId: 1,
    "record.studentId": 1,
    "record.academicYearId": 1,
    "record.createdAt": -1,
  }, { name: "student_annual_fee_order_history", partialFilterExpression: { "record.sourceType": "ANNUAL" } });
  await orders.createIndex(
    { tenantId: 1, "record.sourceType": 1, "record.sourceId": 1, "record.studentId": 1 },
    { unique: true, name: "uq_fee_order_source_student", partialFilterExpression: { "record.sourceType": { $exists: true } } },
  );
  await orders.createIndex({
    tenantId: 1,
    "record.campusId": 1,
    "record.status": 1,
  });
  return new MongoFeeOrderRepository(
    createMongoCollectionAdapter(orders),
    env,
  );
}
let singleton: Promise<FeeOrderRepository> | undefined;
export function feeOrderRepository() {
  singleton ??= createFeeOrderRepository();
  return singleton;
}
