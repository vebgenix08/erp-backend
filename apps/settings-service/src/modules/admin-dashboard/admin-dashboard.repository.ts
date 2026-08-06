import { BadRequestError } from "@school-erp/errors";
import { getMongoConnection, type MongoEnvLike } from "@school-erp/mongodb";
import type {
  AdminDashboardActivity,
  AdminDashboardApplication,
  AdminDashboardSecurityChange,
  AdminDashboardScope,
  AdminDashboardSnapshot,
} from "./admin-dashboard.model";

const required = (value: string, field: string) => {
  const result = value.trim();
  if (!result) throw new BadRequestError(`${field} is required`);
  return result;
};

const runtimeEnv = (): MongoEnvLike =>
  (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {};

function dayPeriods(from: Date, to: Date) {
  const periods: Array<{ period: string; label: string }> = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end && periods.length < 62) {
    periods.push({
      period: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return periods;
}

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
    enquiriesToday,
    pendingEnquiryFollowUps,
    applicationsSubmittedToday,
    paymentsToday,
    unpaidStudentIds,
    failedStaffInvites,
    failedFinanceEvents,
    failedAdmissionEvents,
    applicationStatusRows,
    studentClassRows,
    collectionTrendRows,
    paymentMethodRows,
    outstandingClassRows,
    recentRoleAssignments,
    recentPermissionBindings,
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
    admissions.collection("admissions_enquiries").countDocuments({
      tenantId: owner,
      campusId: scope.campusId,
      createdAt: { $gte: today, $lt: tomorrow },
    }),
    admissions.collection("admissions_enquiries").countDocuments({
      tenantId: owner,
      campusId: scope.campusId,
      status: "FOLLOW_UP",
    }),
    admissions.collection("admissions_applications").countDocuments({
      ...applicationMatch,
      submittedAt: { $gte: today, $lt: tomorrow },
    }),
    finance.collection("finance_payments").countDocuments({
      ...paymentMatch,
      paidAt: { $gte: today, $lt: tomorrow },
      status: { $ne: "VOIDED" },
    }),
    finance.collection("finance_fee_orders").distinct("record.studentId", {
      tenantId: owner,
      "record.campusId": scope.campusId,
      "record.academicYearId": scope.academicYearId,
      "record.balanceMinor": { $gt: 0 },
      "record.status": { $ne: "CANCELLED" },
    }),
    identity.collection("identity_employees").countDocuments({
      tenantId: owner,
      campusIds: scope.campusId,
      loginStatus: "FAILED",
    }),
    finance.collection("finance_fee_order_recoveries").countDocuments({
      tenantId: owner,
      "record.campusId": scope.campusId,
      "record.academicYearId": scope.academicYearId,
      "record.status": "PENDING",
    }),
    admissions.collection("admissions_applications").countDocuments({
      ...applicationMatch,
      "pendingEvents.0": { $exists: true },
    }),
    admissions.collection("admissions_applications").aggregate<{ _id: string; count: number }>([
      { $match: applicationMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    academics.collection("academics_enrollments").aggregate<{ _id: string | null; count: number }>([
      { $match: enrollmentMatch },
      { $group: { _id: { $ifNull: ["$classId", null] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    finance.collection("finance_payments").aggregate<{ _id: string; amountMinor: number }>([
      { $match: { ...paymentMatch, paidAt: { $gte: scope.from, $lte: scope.to }, status: { $ne: "VOIDED" } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } }, amountMinor: { $sum: "$amountMinor" } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    finance.collection("finance_payments").aggregate<{ _id: string; paymentCount: number; amountMinor: number }>([
      { $match: { ...paymentMatch, paidAt: { $gte: today, $lt: tomorrow }, status: { $ne: "VOIDED" } } },
      { $group: { _id: "$method", paymentCount: { $sum: 1 }, amountMinor: { $sum: "$amountMinor" } } },
      { $sort: { amountMinor: -1 } },
    ]).toArray(),
    finance.collection("finance_fee_orders").aggregate<{ _id: string; studentIds: string[]; outstandingMinor: number }>([
      { $match: {
        tenantId: owner,
        "record.campusId": scope.campusId,
        "record.academicYearId": scope.academicYearId,
        "record.balanceMinor": { $gt: 0 },
        "record.status": { $ne: "CANCELLED" },
      } },
      { $group: {
        _id: "$record.classId",
        studentIds: { $addToSet: "$record.studentId" },
        outstandingMinor: { $sum: "$record.balanceMinor" },
      } },
      { $sort: { outstandingMinor: -1 } },
      { $limit: 5 },
    ]).toArray(),
    identity.collection("identity_user_role_assignments").find({ tenantId: owner }).sort({ updatedAt: -1 }).limit(5).toArray(),
    identity.collection("identity_role_permissions").find({ tenantId: owner }).sort({ updatedAt: -1 }).limit(5).toArray(),
    admissions.collection("admissions_applications").find(applicationMatch).sort({ updatedAt: -1 }).limit(6).toArray(),
    finance.collection("finance_payments").find(paymentMatch).sort({ paidAt: -1 }).limit(6).toArray(),
  ]);

  const collectedToday = await finance.collection("finance_payments").aggregate<{ amountMinor: number }>([
    { $match: { ...paymentMatch, paidAt: { $gte: today, $lt: tomorrow }, status: { $ne: "VOIDED" } } },
    { $group: { _id: null, amountMinor: { $sum: "$amountMinor" } } },
  ]).toArray();
  const orderOwners = new Set(orderStudentIds.map(String));
  const studentsMissingFeeOrders = enrolledStudentIds.filter((id) => !orderOwners.has(String(id))).length;
  const collectionsByDay = new Map(collectionTrendRows.map((row) => [row._id, row.amountMinor]));
  const classIds = studentClassRows
    .map((row) => row._id)
    .filter((id): id is string => Boolean(id));
  const classDocuments = classIds.length
    ? await academics.collection("academics_classes").find({
        tenantId: owner,
        id: { $in: classIds },
      }).toArray()
    : [];
  const classNames = new Map(
    classDocuments.map((item) => [String(item.id ?? item._id), String(item.name ?? "Unknown class")]),
  );
  const outstandingClassIds = outstandingClassRows.map((row) => row._id).filter(Boolean);
  if (outstandingClassIds.some((id) => !classNames.has(id))) {
    const extraClasses = await academics.collection("academics_classes").find({
      tenantId: owner,
      id: { $in: outstandingClassIds },
    }).toArray();
    for (const item of extraClasses) {
      classNames.set(String(item.id ?? item._id), String(item.name ?? "Unknown class"));
    }
  }
  const securityUserIds = recentRoleAssignments
    .map((item) => item.userId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const securityUsers = securityUserIds.length
    ? await identity.collection("identity_users").find({
        tenantId: owner,
        id: { $in: securityUserIds },
      }).toArray()
    : [];
  const securityUserLabels = new Map<string, string>();
  for (const user of securityUsers) {
    const label = String(user.name ?? user.email ?? "Tenant user");
    if (user.id) securityUserLabels.set(String(user.id), label);
  }
  const recentSecurityChanges: AdminDashboardSecurityChange[] = [
    ...recentRoleAssignments.map((item) => ({
      id: String(item.id ?? item._id),
      change: item.isActive === false ? "Role assignment revoked" : "Role assignment updated",
      subject: securityUserLabels.get(String(item.userId)) ?? "Tenant user",
      occurredAt: new Date(item.updatedAt as Date),
      status: item.isActive === false ? "REVOKED" : "ACTIVE",
    })),
    ...recentPermissionBindings.map((item) => ({
      id: String(item.id ?? item._id),
      change: "Role permission updated",
      subject: String(item.permission ?? "Permission"),
      occurredAt: new Date(item.updatedAt as Date),
      status: "ACTIVE",
    })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 5);
  const recentApplicationViews: AdminDashboardApplication[] = recentApplications.map((item) => ({
    id: String(item.id ?? item._id),
    ...(item.applicationNumber ? { applicationNumber: String(item.applicationNumber) } : {}),
    studentName: String(item.studentName ?? "Applicant"),
    ...(item.phone ? { phone: String(item.phone) } : {}),
    status: String(item.status ?? "DRAFT"),
    updatedAt: new Date(item.updatedAt as Date),
  }));
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
    enquiriesToday,
    pendingEnquiryFollowUps,
    applicationsSubmittedToday,
    paymentsToday,
    unpaidStudents: unpaidStudentIds.length,
    failedStaffInvites,
    failedFinanceEvents,
    failedAdmissionEvents,
    applicationCount: applicationStatusRows.reduce((total, row) => total + row.count, 0),
    applicationStatusDistribution: applicationStatusRows.map((row) => ({
      key: row._id,
      label: row._id.replaceAll("_", " "),
      count: row.count,
    })),
    studentClassDistribution: studentClassRows.map((row) => ({
      key: row._id ?? "UNASSIGNED",
      label: row._id ? (classNames.get(row._id) ?? "Unknown class") : "Unassigned",
      count: row.count,
    })),
    admissionsTrend: [],
    collectionTrend: dayPeriods(scope.from, scope.to).map((item) => ({
      ...item,
      value: collectionsByDay.get(item.period) ?? 0,
    })),
    collectionByPaymentMethod: paymentMethodRows.map((row) => ({
      method: row._id,
      paymentCount: row.paymentCount,
      amountMinor: row.amountMinor,
    })),
    topOutstandingClasses: outstandingClassRows.map((row) => ({
      classId: row._id,
      className: classNames.get(row._id) ?? "Unknown class",
      studentCount: row.studentIds.length,
      outstandingMinor: row.outstandingMinor,
    })),
    recentSecurityChanges,
    recentApplications: recentApplicationViews,
    recentActivity: activities,
    generatedAt: new Date(),
  };
}
