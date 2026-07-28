import { ConflictError } from "@school-erp/errors";
import {
  getMongoConnection,
  type MongoEnvLike,
  withTransaction,
} from "@school-erp/mongodb";
import type { Collection, Filter } from "mongodb";
import type { FeeOrderRecord } from "../fee-orders/fee-orders.model";
import {
  feeOrderRepository,
  type FeeOrderRepository,
} from "../fee-orders/fee-orders.repository";
import type { PaymentRecord } from "../payments/payments.model";
import {
  paymentRepository,
  type PaymentRepository,
} from "../payments/payments.repository";
import type {
  PaymentAdjustmentFilter,
  PaymentAdjustmentRecord,
} from "./payment-adjustments.model";

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
type AdjustmentDocument = PaymentAdjustmentRecord & { _id: string };
export interface AdjustmentCommit {
  expectedPaymentUpdatedAt: Date;
  expectedOrderUpdatedAt: Map<string, Date>;
  payment: PaymentRecord;
  orders: FeeOrderRecord[];
  adjustment: Omit<PaymentAdjustmentRecord, "id" | "adjustmentNumber">;
}
export interface PaymentAdjustmentRepository {
  getByIdempotencyKey(
    tenantId: string,
    key: string,
  ): Promise<PaymentAdjustmentRecord | null>;
  list(
    tenantId: string,
    filter?: PaymentAdjustmentFilter,
  ): Promise<PaymentAdjustmentRecord[]>;
  commit(
    tenantId: string,
    input: AdjustmentCommit,
  ): Promise<PaymentAdjustmentRecord>;
}
const clone = (record: PaymentAdjustmentRecord): PaymentAdjustmentRecord => ({
  ...record,
  allocations: record.allocations.map((item) => ({ ...item })),
  createdAt: new Date(record.createdAt),
});
const number = (academicYearId: string, value: number) =>
  `ADJ-${academicYearId
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase()}-${String(value).padStart(6, "0")}`;
const matches = (
  record: PaymentAdjustmentRecord,
  filter: PaymentAdjustmentFilter,
) =>
  (!filter.paymentId || record.paymentId === filter.paymentId) &&
  (!filter.campusId || record.campusId === filter.campusId) &&
  (!filter.academicYearId || record.academicYearId === filter.academicYearId) &&
  (!filter.type || record.type === filter.type);

export class InMemoryPaymentAdjustmentRepository
  implements PaymentAdjustmentRepository
{
  private readonly records = new Map<string, PaymentAdjustmentRecord>();
  private readonly sequences = new Map<string, number>();
  constructor(
    private readonly payments: PaymentRepository,
    private readonly orders: FeeOrderRepository,
  ) {}
  async getByIdempotencyKey(tenantId: string, key: string) {
    const record = [...this.records.values()].find(
      (item) => item.tenantId === tenantId && item.idempotencyKey === key,
    );
    return record ? clone(record) : null;
  }
  async list(tenantId: string, filter: PaymentAdjustmentFilter = {}) {
    return [...this.records.values()]
      .filter((item) => item.tenantId === tenantId && matches(item, filter))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clone);
  }
  async commit(tenantId: string, input: AdjustmentCommit) {
    const existing = await this.getByIdempotencyKey(
      tenantId,
      input.adjustment.idempotencyKey,
    );
    if (existing) return existing;
    const currentPayment = await this.payments.getById(
      tenantId,
      input.payment.id,
    );
    if (
      !currentPayment ||
      currentPayment.updatedAt.getTime() !==
        input.expectedPaymentUpdatedAt.getTime()
    )
      throw new ConflictError("payment changed during adjustment");
    for (const order of input.orders) {
      const current = await this.orders.getById(tenantId, order.id);
      if (
        !current ||
        current.updatedAt.getTime() !==
          input.expectedOrderUpdatedAt.get(order.id)?.getTime()
      )
        throw new ConflictError("fee order changed during adjustment");
    }
    const sequence =
      (this.sequences.get(`${tenantId}:${input.adjustment.academicYearId}`) ??
        0) + 1;
    const record: PaymentAdjustmentRecord = {
      ...input.adjustment,
      id: `payment_adjustment_${crypto.randomUUID()}`,
      adjustmentNumber: number(input.adjustment.academicYearId, sequence),
    };
    for (const order of input.orders)
      if (!(await this.orders.replace(tenantId, order)))
        throw new ConflictError("fee order changed during adjustment");
    if (!(await this.payments.replace(tenantId, input.payment)))
      throw new ConflictError("payment changed during adjustment");
    this.sequences.set(
      `${tenantId}:${input.adjustment.academicYearId}`,
      sequence,
    );
    this.records.set(record.id, clone(record));
    return clone(record);
  }
}

class MongoPaymentAdjustmentRepository implements PaymentAdjustmentRepository {
  constructor(
    private readonly adjustments: Collection<AdjustmentDocument>,
    private readonly payments: Collection<PaymentDocument>,
    private readonly orders: Collection<FeeOrderDocument>,
    private readonly sequences: Collection<SequenceDocument>,
    private readonly env: MongoEnvLike,
  ) {}
  async getByIdempotencyKey(tenantId: string, key: string) {
    const record = await this.adjustments.findOne({
      tenantId,
      idempotencyKey: key,
    });
    return record ? clone(record) : null;
  }
  async list(tenantId: string, filter: PaymentAdjustmentFilter = {}) {
    const query: Record<string, unknown> = { tenantId };
    if (filter.paymentId) query.paymentId = filter.paymentId;
    if (filter.campusId) query.campusId = filter.campusId;
    if (filter.academicYearId) query.academicYearId = filter.academicYearId;
    if (filter.type) query.type = filter.type;
    return (
      await this.adjustments
        .find(query)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()
    ).map(clone);
  }
  async commit(tenantId: string, input: AdjustmentCommit) {
    const existing = await this.getByIdempotencyKey(
      tenantId,
      input.adjustment.idempotencyKey,
    );
    if (existing) return existing;
    try {
      return await withTransaction(
        async (session) => {
          const options = session ? { session } : {};
          const retry = await this.adjustments.findOne(
            { tenantId, idempotencyKey: input.adjustment.idempotencyKey },
            options,
          );
          if (retry) return clone(retry);
          const sequence = await this.sequences.findOneAndUpdate(
            {
              _id: `adjustment:${tenantId}:${input.adjustment.academicYearId}`,
            },
            { $inc: { value: 1 } },
            {
              upsert: true,
              returnDocument: "after",
              includeResultMetadata: false,
              ...options,
            },
          );
          for (const order of input.orders) {
            const expected = input.expectedOrderUpdatedAt.get(order.id);
            const optimisticFilter = {
              tenantId,
              _id: order.id,
              "record.updatedAt": expected,
            } as unknown as Filter<FeeOrderDocument>;
            const result = await this.orders.replaceOne(
              optimisticFilter,
              { tenantId, record: order },
              options,
            );
            if (result.modifiedCount !== 1)
              throw new ConflictError("fee order changed during adjustment");
          }
          const paymentResult = await this.payments.replaceOne(
            {
              tenantId,
              _id: input.payment.id,
              updatedAt: input.expectedPaymentUpdatedAt,
            },
            { ...input.payment },
            options,
          );
          if (paymentResult.modifiedCount !== 1)
            throw new ConflictError("payment changed during adjustment");
          const record: PaymentAdjustmentRecord = {
            ...input.adjustment,
            id: `payment_adjustment_${crypto.randomUUID()}`,
            adjustmentNumber: number(
              input.adjustment.academicYearId,
              sequence?.value ?? 1,
            ),
          };
          await this.adjustments.insertOne(
            { ...record, _id: record.id },
            options,
          );
          return clone(record);
        },
        {
          env: this.env,
          context: { tenantId, userId: input.adjustment.createdBy },
        },
      );
    } catch (error) {
      const retry = await this.getByIdempotencyKey(
        tenantId,
        input.adjustment.idempotencyKey,
      );
      if (retry) return retry;
      throw error;
    }
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
export async function createPaymentAdjustmentRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<PaymentAdjustmentRepository> {
  if (!hasMongo(env))
    return new InMemoryPaymentAdjustmentRepository(
      await paymentRepository(),
      await feeOrderRepository(),
    );
  const connection = await getMongoConnection(env);
  const db = connection.client.db(connection.dbName);
  const adjustments = db.collection<AdjustmentDocument>(
    "finance_payment_adjustments",
  );
  const payments = db.collection<PaymentDocument>("finance_payments");
  const orders = db.collection<FeeOrderDocument>("finance_fee_orders");
  const sequences = db.collection<SequenceDocument>("finance_sequences");
  await adjustments.createIndex(
    { tenantId: 1, idempotencyKey: 1 },
    { unique: true },
  );
  await adjustments.createIndex({ tenantId: 1, paymentId: 1, createdAt: -1 });
  return new MongoPaymentAdjustmentRepository(
    adjustments,
    payments,
    orders,
    sequences,
    env,
  );
}
let singleton: Promise<PaymentAdjustmentRepository> | undefined;
export function paymentAdjustmentRepository() {
  singleton ??= createPaymentAdjustmentRepository();
  return singleton;
}
