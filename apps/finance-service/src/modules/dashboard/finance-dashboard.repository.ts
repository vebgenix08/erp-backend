import { BadRequestError } from "@school-erp/errors";
import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import type { Collection } from "mongodb";

export interface FinanceDashboardScope {
  campusId: string;
  academicYearId: string;
  today: string;
}

export interface FinanceDashboardSummary {
  totalAssignedMinor: number;
  grossCollectedMinor: number;
  reversedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  collectedTodayMinor: number;
  openOrders: number;
  paidOrders: number;
  paymentCount: number;
  adjustmentCount: number;
}

export interface FinanceDashboardRepository {
  summarize(
    tenantId: string,
    scope: FinanceDashboardScope,
  ): Promise<FinanceDashboardSummary>;
}

interface AggregateResult {
  totalMinor?: number;
  balanceMinor?: number;
  amountMinor?: number;
  todayMinor?: number;
  openOrders?: number;
  paidOrders?: number;
  count?: number;
}

function requiredTenant(value: string) {
  const tenantId = value.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
}

async function firstAggregate(
  collection: Collection,
  pipeline: Record<string, unknown>[],
) {
  return (
    (await collection.aggregate<AggregateResult>(pipeline).toArray())[0] ?? {}
  );
}

class MongoFinanceDashboardRepository implements FinanceDashboardRepository {
  constructor(
    private readonly orders: Collection,
    private readonly payments: Collection,
    private readonly adjustments: Collection,
  ) {}

  async summarize(tenantId: string, scope: FinanceDashboardScope) {
    const owner = requiredTenant(tenantId);
    const orderMatch = {
      tenantId: owner,
      "record.campusId": scope.campusId,
      "record.academicYearId": scope.academicYearId,
      "record.status": { $ne: "CANCELLED" },
    };
    const transactionMatch = {
      tenantId: owner,
      campusId: scope.campusId,
      academicYearId: scope.academicYearId,
    };
    const start = new Date(`${scope.today}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const [orders, payments, adjustments] = await Promise.all([
      firstAggregate(this.orders, [
        { $match: orderMatch },
        {
          $group: {
            _id: null,
            totalMinor: { $sum: "$record.totalMinor" },
            balanceMinor: { $sum: "$record.balanceMinor" },
            openOrders: {
              $sum: {
                $cond: [
                  { $in: ["$record.status", ["OPEN", "PARTIALLY_PAID"]] },
                  1,
                  0,
                ],
              },
            },
            paidOrders: {
              $sum: {
                $cond: [{ $eq: ["$record.status", "PAID"] }, 1, 0],
              },
            },
          },
        },
      ]),
      firstAggregate(this.payments, [
        { $match: transactionMatch },
        {
          $group: {
            _id: null,
            amountMinor: { $sum: "$amountMinor" },
            count: { $sum: 1 },
            todayMinor: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$paidAt", start] },
                      { $lt: ["$paidAt", end] },
                    ],
                  },
                  "$amountMinor",
                  0,
                ],
              },
            },
          },
        },
      ]),
      firstAggregate(this.adjustments, [
        { $match: transactionMatch },
        {
          $group: {
            _id: null,
            amountMinor: { $sum: "$amountMinor" },
            count: { $sum: 1 },
            todayMinor: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$createdAt", start] },
                      { $lt: ["$createdAt", end] },
                    ],
                  },
                  "$amountMinor",
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);
    const grossCollectedMinor = payments.amountMinor ?? 0;
    const reversedMinor = adjustments.amountMinor ?? 0;
    return {
      totalAssignedMinor: orders.totalMinor ?? 0,
      grossCollectedMinor,
      reversedMinor,
      collectedMinor: grossCollectedMinor - reversedMinor,
      outstandingMinor: orders.balanceMinor ?? 0,
      collectedTodayMinor:
        (payments.todayMinor ?? 0) - (adjustments.todayMinor ?? 0),
      openOrders: orders.openOrders ?? 0,
      paidOrders: orders.paidOrders ?? 0,
      paymentCount: payments.count ?? 0,
      adjustmentCount: adjustments.count ?? 0,
    };
  }
}

function runtimeEnv(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}

export async function createFinanceDashboardRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<FinanceDashboardRepository> {
  const connection = await getMongoConnection(env);
  const db = connection.client.db(connection.dbName);
  return new MongoFinanceDashboardRepository(
    db.collection("finance_fee_orders"),
    db.collection("finance_payments"),
    db.collection("finance_payment_adjustments"),
  );
}

let singleton: Promise<FinanceDashboardRepository> | undefined;
export function financeDashboardRepository() {
  singleton ??= createFinanceDashboardRepository();
  return singleton;
}
