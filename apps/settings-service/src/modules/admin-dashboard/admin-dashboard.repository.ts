import { BadRequestError } from "@school-erp/errors";
import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import type { AdminDashboardActivity, AdminDashboardScope, AdminDashboardSnapshot } from "./admin-dashboard.model";

const required = (value: string, field: string) => {
  const result = value.trim();
  if (!result) throw new BadRequestError(`${field} is required`);
  return result;
};

const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};

export async function readAdminDashboard(
  tenantId: string,
  scope: AdminDashboardScope,
  env: MongoEnvLike = runtimeEnv(),
): Promise<AdminDashboardSnapshot> {
  const owner = required(tenantId, "tenantId");
  const connection = await getMongoConnection(env);
  const stage = env.environment ?? env.STAGE ?? env.NODE_ENV ?? "dev";
  const academics = connection.client.db(`academics-service_${stage}`);
  const admissions = connection.client.db(`admissions-service_${stage}`);
  const identity = connection.client.db(`identity-service_${stage}`);
  const finance = connection.client.db(`finance-service_${stage}`);
  const enrollmentMatch = {
    tenantId: owner,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
    status: "ACTIVE",
  };
  const applicationMatch = {
    tenantId: owner,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
  };
  const paymentMatch = {
    tenantId: owner,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
  };
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    activeStudents,
    activeStaff,
    awaiting,
    confirmed,
    missingSections,
    enrolledStudentIds,
    orderStudentIds,
    financeTotals,
    recentApplications,
    recentPayments,
  ] = await Promise.all([
    academics.collection("academics_enrollments").countDocuments(enrollmentMatch),
    identity.collection("identity_employees").countDocuments({
      tenantId: owner,
      status: "ACTIVE",
      campusIds: scope.campusId,
    }),
    admissions.collection("admissions_applications").countDocuments({
      ...applicationMatch,
      status: { $in: ["SUBMITTED", "APPROVED"] },
    }),
    admissions.collection("admissions_applications").countDocuments({
      ...applicationMatch,
      status: "CONFIRMED",
      confirmedAt: { $gte: scope.from, $lte: scope.to },
    }),
    academics.collection("academics_enrollments").countDocuments({
      ...enrollmentMatch,
      $or: [{ sectionId: { $exists: false } }, { sectionId: null }, { sectionId: "" }],
    }),
    academics.collection("academics_enrollments").distinct("studentId", enrollmentMatch),
    finance.collection("finance_fee_orders").distinct("record.studentId", {
      tenantId: owner,
      "record.campusId": scope.campusId,
      "record.academicYearId": scope.academicYearId,
      "record.status": { $ne: "CANCELLED" },
    }),
    finance.collection("finance_fee_orders").aggregate<{ outstandingMinor: number }>([
      { $match: {
        tenantId: owner,
        "record.campusId": scope.campusId,
        "record.academicYearId": scope.academicYearId,
        "record.status": { $ne: "CANCELLED" },
      } },
      { $group: { _id: null, outstandingMinor: { $sum: "$record.balanceMinor" } } },
    ]).toArray(),
    admissions.collection("admissions_applications").find(applicationMatch).sort({ updatedAt: -1 }).limit(6).toArray(),
    finance.collection("finance_payments").find(paymentMatch).sort({ paidAt: -1 }).limit(6).toArray(),
  ]);

  const collectedToday = await finance.collection("finance_payments").aggregate<{ amountMinor: number }>([
    { $match: { ...paymentMatch, paidAt: { $gte: today, $lt: tomorrow }, status: { $ne: "VOIDED" } } },
    { $group: { _id: null, amountMinor: { $sum: "$amountMinor" } } },
  ]).toArray();
  const orderOwners = new Set(orderStudentIds.map(String));
  const studentsMissingFeeOrders = enrolledStudentIds.filter((id) => !orderOwners.has(String(id))).length;
  const activities: AdminDashboardActivity[] = [
    ...recentApplications.map((item) => ({
      id: String(item.id ?? item._id),
      occurredAt: new Date(item.updatedAt as Date),
      activity: item.status === "CONFIRMED" ? "Student admitted" : "Application updated",
      module: "ADMISSIONS" as const,
      subject: String(item.studentName ?? "Applicant"),
      performedBy: String(item.confirmedBy ?? item.createdBy ?? "System"),
      status: String(item.status ?? "UPDATED"),
    })),
    ...recentPayments.map((item) => ({
      id: String(item.id ?? item._id),
      occurredAt: new Date(item.paidAt as Date),
      activity: "Payment collected",
      module: "FINANCE" as const,
      subject: String(item.studentName ?? "Student"),
      performedBy: String(item.collectedBy ?? "System"),
      status: String(item.status ?? "SUCCESS"),
    })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 10);

  return {
    activeStudents,
    activeStaff,
    applicationsAwaitingAction: awaiting,
    admissionsConfirmed: confirmed,
    collectedTodayMinor: collectedToday[0]?.amountMinor ?? 0,
    outstandingMinor: financeTotals[0]?.outstandingMinor ?? 0,
    openWorkItems: awaiting + missingSections + studentsMissingFeeOrders,
    studentsMissingSections: missingSections,
    studentsMissingFeeOrders,
    recentActivity: activities,
    generatedAt: new Date(),
  };
}
