import { createTenantMongoCollection, getMongoConnection } from "@school-erp/mongodb";

interface TenantDocument {
  _id: string;
  tenantId: string;
  [key: string]: unknown;
}

interface Scope {
  campusId: string;
  academicYearId: string;
  from: string;
  to: string;
}

export async function readFinanceDashboardSlice(tenantId: string, scope: Scope) {
  const connection = await getMongoConnection();
  const db = connection.client.db(connection.dbName);
  const payments = createTenantMongoCollection(db.collection<TenantDocument>("finance_payments"));
  const orders = createTenantMongoCollection(db.collection<TenantDocument>("finance_fee_orders"));
  const recoveries = createTenantMongoCollection(
    db.collection<TenantDocument>("finance_fee_order_recoveries"),
  );
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const paymentMatch = {
    tenantId,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
  };
  const orderMatch = {
    tenantId,
    "record.campusId": scope.campusId,
    "record.academicYearId": scope.academicYearId,
    "record.status": { $ne: "CANCELLED" },
  };
  const [
    orderStudentIds,
    outstandingRows,
    paymentsToday,
    unpaidStudentIds,
    failedEvents,
    trendRows,
    methodRows,
    outstandingClassRows,
    recentPayments,
    collectedTodayRows,
  ] = await Promise.all([
    orders.distinct("record.studentId", orderMatch),
    orders
      .aggregate<{ outstandingMinor: number }>([
        { $match: orderMatch },
        {
          $group: {
            _id: null,
            outstandingMinor: { $sum: "$record.balanceMinor" },
          },
        },
      ])
      .toArray(),
    payments.countDocuments({
      ...paymentMatch,
      paidAt: { $gte: today, $lt: tomorrow },
      status: { $ne: "VOIDED" },
    }),
    orders.distinct("record.studentId", {
      ...orderMatch,
      "record.balanceMinor": { $gt: 0 },
    }),
    recoveries.countDocuments({
      tenantId,
      "record.campusId": scope.campusId,
      "record.academicYearId": scope.academicYearId,
      "record.status": "PENDING",
    }),
    payments
      .aggregate<{ _id: string; amountMinor: number }>([
        {
          $match: {
            ...paymentMatch,
            paidAt: { $gte: new Date(scope.from), $lte: new Date(scope.to) },
            status: { $ne: "VOIDED" },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
            amountMinor: { $sum: "$amountMinor" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    payments
      .aggregate<{ _id: string; paymentCount: number; amountMinor: number }>([
        {
          $match: {
            ...paymentMatch,
            paidAt: { $gte: today, $lt: tomorrow },
            status: { $ne: "VOIDED" },
          },
        },
        {
          $group: {
            _id: "$method",
            paymentCount: { $sum: 1 },
            amountMinor: { $sum: "$amountMinor" },
          },
        },
        { $sort: { amountMinor: -1 } },
      ])
      .toArray(),
    orders
      .aggregate<{
        _id: string;
        studentIds: string[];
        outstandingMinor: number;
      }>([
        { $match: { ...orderMatch, "record.balanceMinor": { $gt: 0 } } },
        {
          $group: {
            _id: "$record.classId",
            studentIds: { $addToSet: "$record.studentId" },
            outstandingMinor: { $sum: "$record.balanceMinor" },
          },
        },
        { $sort: { outstandingMinor: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
    payments.find(paymentMatch).sort({ paidAt: -1 }).limit(6).toArray(),
    payments
      .aggregate<{ amountMinor: number }>([
        {
          $match: {
            ...paymentMatch,
            paidAt: { $gte: today, $lt: tomorrow },
            status: { $ne: "VOIDED" },
          },
        },
        { $group: { _id: null, amountMinor: { $sum: "$amountMinor" } } },
      ])
      .toArray(),
  ]);
  return {
    orderStudentIds: orderStudentIds.map(String),
    collectedTodayMinor: collectedTodayRows[0]?.amountMinor ?? 0,
    outstandingMinor: outstandingRows[0]?.outstandingMinor ?? 0,
    paymentsToday,
    unpaidStudents: unpaidStudentIds.length,
    failedFinanceEvents: failedEvents,
    collectionTrendValues: Object.fromEntries(trendRows.map((row) => [row._id, row.amountMinor])),
    collectionByPaymentMethod: methodRows.map((row) => ({
      method: row._id,
      paymentCount: row.paymentCount,
      amountMinor: row.amountMinor,
    })),
    topOutstandingClasses: outstandingClassRows.map((row) => ({
      classId: row._id,
      studentCount: row.studentIds.length,
      outstandingMinor: row.outstandingMinor,
    })),
    recentActivity: recentPayments.map((item) => ({
      id: String(item.id ?? item._id),
      occurredAt: new Date(item.paidAt as Date),
      activity: "Payment collected",
      module: "FINANCE",
      subject: String(item.studentName ?? "Student"),
      performedBy: String(item.collectedBy ?? "System"),
      status: String(item.status ?? "SUCCESS"),
    })),
  };
}
