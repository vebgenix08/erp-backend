import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@school-erp/errors";
import {
  getMongoConnection,
  type MongoEnvLike,
  withTransaction,
} from "@school-erp/mongodb";
import { issueConfiguredNumber } from "@school-erp/numbering";
import type { ClientSession, Collection, Filter } from "mongodb";
import type { FeeOrderRecord } from "../fee-orders/fee-orders.model";
import {
  feeOrderRepository,
  InMemoryFeeOrderRepository,
  type FeeOrderRepository,
} from "../fee-orders/fee-orders.repository";
import type {
  CollectPaymentInput,
  PaymentAllocation,
  PaymentChargeAllocationInput,
  PaymentFilter,
  PaymentPage,
  PaymentRecord,
} from "./payments.model";

interface PaymentDocument extends PaymentRecord {
  _id: string;
}
interface FeeOrderDocument {
  _id: string;
  tenantId: string;
  record: FeeOrderRecord;
}
interface SequenceDocument {
  _id: string;
  value: number;
}

export interface PaymentRepository {
  collect(
    tenantId: string,
    actorId: string,
    input: CollectPaymentInput,
  ): Promise<PaymentRecord>;
  getById(tenantId: string, id: string): Promise<PaymentRecord | null>;
  getByReceiptNumber(
    tenantId: string,
    receiptNumber: string,
  ): Promise<PaymentRecord | null>;
  list(tenantId: string, filter?: PaymentFilter): Promise<PaymentRecord[]>;
  listPage(tenantId: string, filter?: PaymentFilter): Promise<PaymentPage>;
  replace(
    tenantId: string,
    record: PaymentRecord,
  ): Promise<PaymentRecord | null>;
}

function tenant(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError("tenantId is required");
  return normalized;
}
function clone(record: PaymentRecord): PaymentRecord {
  return {
    ...record,
    allocations: record.allocations.map((item) => ({
      ...item,
      chargeAllocations: (item.chargeAllocations ?? []).map((charge) => ({
        ...charge,
      })),
    })),
    paidAt: new Date(record.paidAt),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}
function receiptNumber(academicYearId: string, sequence: number) {
  return `RCP-${academicYearId
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase()}-${String(sequence).padStart(6, "0")}`;
}

function allocate(
  order: FeeOrderRecord,
  amountMinor: number,
  at: Date,
  manualAllocations?: PaymentChargeAllocationInput[],
): { order: FeeOrderRecord; allocation: PaymentAllocation } {
  if (order.status === "CANCELLED" || order.status === "PAID")
    throw new ConflictError(`fee order ${order.orderNumber} is not payable`);
  if (amountMinor > order.balanceMinor)
    throw new ConflictError(
      `payment exceeds the balance for ${order.orderNumber}`,
    );
  if (
    order.collectionPolicy === "FULL_ONLY" &&
    amountMinor !== order.balanceMinor
  )
    throw new ConflictError(
      `payment must clear the full balance for ${order.orderNumber}`,
    );
  const manualByCharge = manualAllocations
    ? new Map(manualAllocations.map((item) => [item.chargeId, item.amountMinor]))
    : null;
  if (manualByCharge) {
    for (const chargeId of manualByCharge.keys()) {
      if (!order.charges.some((charge) => charge.id === chargeId))
        throw new ConflictError(
          `manual allocation references an unknown charge on ${order.orderNumber}`,
        );
    }
  }
  let remaining = amountMinor;
  const chargeAllocations: PaymentAllocation["chargeAllocations"] = [];
  const charges = order.charges
    .map((charge) => ({ ...charge }))
    .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
    .map((charge) => {
      const requested = manualByCharge?.get(charge.id);
      const applied =
        requested === undefined
          ? manualByCharge
            ? 0
            : Math.min(charge.balanceMinor, remaining)
          : requested;
      if (applied > charge.balanceMinor)
        throw new ConflictError(
          `manual allocation exceeds the balance for ${charge.label}`,
        );
      remaining -= applied;
      if (applied > 0)
        chargeAllocations.push({
          chargeId: charge.id,
          feeHeadId: charge.feeHeadId,
          label: charge.label,
          amountMinor: applied,
        });
      return {
        ...charge,
        paidMinor: charge.paidMinor + applied,
        balanceMinor: charge.balanceMinor - applied,
      };
    });
  if (remaining !== 0)
    throw new ConflictError(
      `fee order ${order.orderNumber} has an inconsistent balance`,
    );
  const paidMinor = order.paidMinor + amountMinor;
  const balanceMinor = order.totalMinor - paidMinor;
  return {
    order: {
      ...order,
      charges,
      paidMinor,
      balanceMinor,
      status: balanceMinor === 0 ? "PAID" : "PARTIALLY_PAID",
      updatedAt: at,
    },
    allocation: {
      feeOrderId: order.id,
      label: `${order.orderNumber} · ${order.structureName}`,
      amountMinor,
      chargeAllocations,
    },
  };
}

function validateOrders(orders: FeeOrderRecord[], input: CollectPaymentInput) {
  if (orders.length !== input.allocations.length)
    throw new NotFoundError("one or more fee orders were not found");
  const first = orders[0];
  if (!first) throw new BadRequestError("at least one allocation is required");
  for (const order of orders) {
    if (order.studentId !== input.studentId)
      throw new ConflictError(
        "all fee orders must belong to the selected student",
      );
    if (
      order.campusId !== first.campusId ||
      order.academicYearId !== first.academicYearId
    )
      throw new ConflictError(
        "one payment cannot cross campus or academic-year boundaries",
      );
  }
  return first;
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly records = new Map<string, PaymentRecord>();
  private readonly sequences = new Map<string, number>();
  constructor(
    private readonly orders: FeeOrderRepository = new InMemoryFeeOrderRepository(),
  ) {}
  async collect(tenantId: string, actorId: string, input: CollectPaymentInput) {
    const normalizedTenant = tenant(tenantId);
    const existing = [...this.records.values()].find(
      (item) =>
        item.tenantId === normalizedTenant &&
        item.idempotencyKey === input.idempotencyKey,
    );
    if (existing) return clone(existing);
    const currentOrders = await Promise.all(
      input.allocations.map((allocation) =>
        this.orders.getById(normalizedTenant, allocation.feeOrderId),
      ),
    );
    const authoritative = currentOrders.filter((item): item is FeeOrderRecord =>
      Boolean(item),
    );
    const first = validateOrders(authoritative, input);
    const at = input.paidAt ? new Date(input.paidAt) : new Date();
    const results = authoritative.map((order) =>
      allocate(
        order,
        input.allocations.find((item) => item.feeOrderId === order.id)
          ?.amountMinor ?? 0,
        at,
        input.allocations.find((item) => item.feeOrderId === order.id)
          ?.chargeAllocations,
      ),
    );
    const updated = results.map((result) => result.order);
    const allocations = results.map((result) => result.allocation);
    const amountMinor = allocations.reduce(
      (sum, item) => sum + item.amountMinor,
      0,
    );
    const key = `${normalizedTenant}:${first.academicYearId}`;
    const sequence = (this.sequences.get(key) ?? 0) + 1;
    const now = new Date();
    const record: PaymentRecord = {
      id: `payment_${crypto.randomUUID()}`,
      tenantId: normalizedTenant,
      campusId: first.campusId,
      academicYearId: first.academicYearId,
      studentId: first.studentId,
      studentName: first.studentName,
      receiptNumber: receiptNumber(first.academicYearId, sequence),
      amountMinor,
      reversedMinor: 0,
      currency: "INR",
      method: input.method,
      allocations,
      status: "SUCCESS",
      idempotencyKey: input.idempotencyKey,
      collectedBy: actorId,
      paidAt: at,
      createdAt: now,
      updatedAt: now,
      ...(input.reference ? { reference: input.reference } : {}),
      ...(input.note ? { note: input.note } : {}),
    };
    for (const order of updated) {
      if (!(await this.orders.replace(normalizedTenant, order)))
        throw new ConflictError("fee order changed during payment collection");
    }
    this.sequences.set(key, sequence);
    this.records.set(record.id, clone(record));
    return clone(record);
  }
  async getById(tenantId: string, id: string) {
    const record = this.records.get(id);
    return record?.tenantId === tenant(tenantId) ? clone(record) : null;
  }
  async getByReceiptNumber(tenantId: string, number: string) {
    const normalizedTenant = tenant(tenantId);
    const record = [...this.records.values()].find(
      (item) =>
        item.tenantId === normalizedTenant && item.receiptNumber === number,
    );
    return record ? clone(record) : null;
  }
  async list(tenantId: string, filter: PaymentFilter = {}) {
    return (await this.listPage(tenantId, filter)).items;
  }
  async listPage(tenantId: string, filter: PaymentFilter = {}) {
    const normalizedTenant = tenant(tenantId);
    const rows = [...this.records.values()]
      .filter(
        (item) =>
          item.tenantId === normalizedTenant &&
          (!filter.campusId || item.campusId === filter.campusId) &&
          (!filter.academicYearId ||
            item.academicYearId === filter.academicYearId) &&
          (!filter.studentId || item.studentId === filter.studentId) &&
          (!filter.status || item.status === filter.status) &&
          (!filter.method || item.method === filter.method) &&
          (!filter.paidFrom || item.paidAt >= new Date(filter.paidFrom)) &&
          (!filter.paidTo || item.paidAt <= new Date(`${filter.paidTo}T23:59:59.999Z`)) &&
          (!filter.search ||
            `${item.receiptNumber} ${item.studentName} ${item.reference ?? ""}`
              .toLowerCase()
              .includes(filter.search.toLowerCase())),
      )
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 25;
    return { items: rows.slice(offset, offset + limit).map(clone), total: rows.length, limit, offset };
  }
  async replace(tenantId: string, record: PaymentRecord) {
    const normalizedTenant = tenant(tenantId);
    if (record.tenantId !== normalizedTenant || !this.records.has(record.id))
      return null;
    this.records.set(record.id, clone(record));
    return clone(record);
  }
}

class MongoPaymentRepository implements PaymentRepository {
  constructor(
    private readonly payments: Collection<PaymentDocument>,
    private readonly orders: Collection<FeeOrderDocument>,
    private readonly sequences: Collection<SequenceDocument>,
    private readonly env: MongoEnvLike,
  ) {}
  async collect(tenantId: string, actorId: string, input: CollectPaymentInput) {
    const normalizedTenant = tenant(tenantId);
    const existing = await this.payments.findOne({
      tenantId: normalizedTenant,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) return clone(existing);
    try {
      return await withTransaction(
        async (session) => {
          const options = session ? { session } : {};
          const documents = await this.orders
            .find(
              {
                tenantId: normalizedTenant,
                _id: { $in: input.allocations.map((item) => item.feeOrderId) },
              },
              options,
            )
            .toArray();
          const authoritative = documents.map((item) => item.record);
          const first = validateOrders(authoritative, input);
          const at = input.paidAt ? new Date(input.paidAt) : new Date();
          const results = authoritative.map((order) =>
            allocate(
              order,
              input.allocations.find((item) => item.feeOrderId === order.id)
                ?.amountMinor ?? 0,
              at,
              input.allocations.find((item) => item.feeOrderId === order.id)
                ?.chargeAllocations,
            ),
          );
          const updated = results.map((result) => result.order);
          const allocations = results.map((result) => result.allocation);
          const amountMinor = allocations.reduce(
            (sum, item) => sum + item.amountMinor,
            0,
          );
          const now = new Date();
          const configuredReceiptNumber = await issueConfiguredNumber(
            {
              tenantId: normalizedTenant,
              stream: "RECEIPT",
              idempotencyKey: input.idempotencyKey,
              campusId: first.campusId,
              academicYearId: first.academicYearId,
              at,
            },
            this.env,
          );
          const record: PaymentRecord = {
            id: `payment_${crypto.randomUUID()}`,
            tenantId: normalizedTenant,
            campusId: first.campusId,
            academicYearId: first.academicYearId,
            studentId: first.studentId,
            studentName: first.studentName,
            receiptNumber: configuredReceiptNumber,
            amountMinor,
            reversedMinor: 0,
            currency: "INR",
            method: input.method,
            allocations,
            status: "SUCCESS",
            idempotencyKey: input.idempotencyKey,
            collectedBy: actorId,
            paidAt: at,
            createdAt: now,
            updatedAt: now,
            ...(input.reference ? { reference: input.reference } : {}),
            ...(input.note ? { note: input.note } : {}),
          };
          for (const order of updated) {
            const optimisticFilter = {
                tenantId: normalizedTenant,
                _id: order.id,
                "record.updatedAt": documents.find(
                  (item) => item._id === order.id,
                )?.record.updatedAt,
              } as unknown as Filter<FeeOrderDocument>;
            const result = await this.orders.replaceOne(
              optimisticFilter,
              { tenantId: normalizedTenant, record: order },
              options,
            );
            if (result.modifiedCount !== 1)
              throw new ConflictError(
                "fee order changed during payment collection",
              );
          }
          await this.payments.insertOne({ ...record, _id: record.id }, options);
          return clone(record);
        },
        {
          env: this.env,
          context: { tenantId: normalizedTenant, userId: actorId },
        },
      );
    } catch (error) {
      const retry = await this.payments.findOne({
        tenantId: normalizedTenant,
        idempotencyKey: input.idempotencyKey,
      });
      if (retry) return clone(retry);
      throw error;
    }
  }
  private async find(tenantId: string, filter: Record<string, unknown>) {
    const document = await this.payments.findOne({
      tenantId: tenant(tenantId),
      ...filter,
    });
    return document ? clone(document) : null;
  }
  async getById(tenantId: string, id: string) {
    return this.find(tenantId, { _id: id });
  }
  async getByReceiptNumber(tenantId: string, number: string) {
    return this.find(tenantId, { receiptNumber: number });
  }
  async list(tenantId: string, filter: PaymentFilter = {}) {
    return (await this.listPage(tenantId, filter)).items;
  }
  async listPage(tenantId: string, filter: PaymentFilter = {}) {
    const query: Record<string, unknown> = { tenantId: tenant(tenantId) };
    if (filter.campusId) query.campusId = filter.campusId;
    if (filter.academicYearId) query.academicYearId = filter.academicYearId;
    if (filter.studentId) query.studentId = filter.studentId;
    if (filter.status) query.status = filter.status;
    if (filter.method) query.method = filter.method;
    if (filter.paidFrom || filter.paidTo)
      query.paidAt = {
        ...(filter.paidFrom ? { $gte: new Date(filter.paidFrom) } : {}),
        ...(filter.paidTo ? { $lte: new Date(`${filter.paidTo}T23:59:59.999Z`) } : {}),
      };
    if (filter.search)
      query.$or = [
        { receiptNumber: { $regex: filter.search, $options: "i" } },
        { studentName: { $regex: filter.search, $options: "i" } },
        { reference: { $regex: filter.search, $options: "i" } },
      ];
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 25;
    const [items, total] = await Promise.all([
      this.payments
        .find(query)
        .sort({ paidAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      this.payments.countDocuments(query),
    ]);
    return { items: items.map(clone), total, limit, offset };
  }
  async replace(tenantId: string, record: PaymentRecord) {
    const normalizedTenant = tenant(tenantId);
    if (record.tenantId !== normalizedTenant) return null;
    const result = await this.payments.replaceOne(
      { tenantId: normalizedTenant, _id: record.id },
      { ...record },
    );
    return result.modifiedCount === 1 ? clone(record) : null;
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
export async function createPaymentRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<PaymentRepository> {
  if (!hasMongo(env))
    return new InMemoryPaymentRepository(await feeOrderRepository());
  const connection = await getMongoConnection(env);
  const db = connection.client.db(connection.dbName);
  const payments = db.collection<PaymentDocument>("finance_payments");
  const orders = db.collection<FeeOrderDocument>("finance_fee_orders");
  const sequences = db.collection<SequenceDocument>("finance_sequences");
  await payments.createIndex(
    { tenantId: 1, idempotencyKey: 1 },
    { unique: true },
  );
  await payments.createIndex(
    { tenantId: 1, receiptNumber: 1 },
    { unique: true },
  );
  await payments.createIndex({ tenantId: 1, studentId: 1, paidAt: -1 });
  return new MongoPaymentRepository(payments, orders, sequences, env);
}
let singleton: Promise<PaymentRepository> | undefined;
export function paymentRepository() {
  singleton ??= createPaymentRepository();
  return singleton;
}
