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

export async function readAdmissionsDashboardSlice(tenantId: string, scope: Scope) {
  const connection = await getMongoConnection();
  const db = connection.client.db(connection.dbName);
  const applications = createTenantMongoCollection(
    db.collection<TenantDocument>("admissions_applications"),
  );
  const enquiries = createTenantMongoCollection(
    db.collection<TenantDocument>("admissions_enquiries"),
  );
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const applicationMatch = {
    tenantId,
    campusId: scope.campusId,
    academicYearId: scope.academicYearId,
  };
  const [
    awaiting,
    confirmed,
    enquiriesToday,
    followUps,
    submittedToday,
    failedEvents,
    statusRows,
    recentApplications,
  ] = await Promise.all([
    applications.countDocuments({
      ...applicationMatch,
      status: { $in: ["SUBMITTED", "APPROVED"] },
    }),
    applications.countDocuments({
      ...applicationMatch,
      status: "CONFIRMED",
      confirmedAt: { $gte: new Date(scope.from), $lte: new Date(scope.to) },
    }),
    enquiries.countDocuments({
      tenantId,
      campusId: scope.campusId,
      createdAt: { $gte: today, $lt: tomorrow },
    }),
    enquiries.countDocuments({
      tenantId,
      campusId: scope.campusId,
      status: "FOLLOW_UP",
    }),
    applications.countDocuments({
      ...applicationMatch,
      submittedAt: { $gte: today, $lt: tomorrow },
    }),
    applications.countDocuments({
      ...applicationMatch,
      "pendingEvents.0": { $exists: true },
    }),
    applications
      .aggregate<{
        _id: string;
        count: number;
      }>([
        { $match: applicationMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    applications.find(applicationMatch).sort({ updatedAt: -1 }).limit(6).toArray(),
  ]);
  const applicationViews = recentApplications.map((item) => ({
    id: String(item.id ?? item._id),
    ...(item.applicationNumber ? { applicationNumber: String(item.applicationNumber) } : {}),
    studentName: String(item.studentName ?? "Applicant"),
    ...(item.phone ? { phone: String(item.phone) } : {}),
    status: String(item.status ?? "DRAFT"),
    updatedAt: new Date(item.updatedAt as Date),
  }));
  return {
    applicationsAwaitingAction: awaiting,
    admissionsConfirmed: confirmed,
    enquiriesToday,
    pendingEnquiryFollowUps: followUps,
    applicationsSubmittedToday: submittedToday,
    failedAdmissionEvents: failedEvents,
    applicationCount: statusRows.reduce((sum, row) => sum + row.count, 0),
    applicationStatusDistribution: statusRows.map((row) => ({
      key: row._id,
      label: row._id.replaceAll("_", " "),
      count: row.count,
    })),
    recentApplications: applicationViews,
    recentActivity: recentApplications.map((item) => ({
      id: String(item.id ?? item._id),
      occurredAt: new Date(item.updatedAt as Date),
      activity: item.status === "CONFIRMED" ? "Student admitted" : "Application updated",
      module: "ADMISSIONS",
      subject: String(item.studentName ?? "Applicant"),
      performedBy: String(item.confirmedBy ?? item.createdBy ?? "System"),
      status: String(item.status ?? "UPDATED"),
    })),
  };
}
