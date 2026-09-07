import { BadRequestError } from "@school-erp/errors";
import { internalServiceInvoker, type InternalServiceInvoker } from "@school-erp/service-client";
import type {
  AdminDashboardActivity,
  AdminDashboardApplication,
  AdminDashboardScope,
  AdminDashboardSecurityChange,
  AdminDashboardSnapshot,
} from "./admin-dashboard.model";

interface AcademicsSlice {
  activeStudents: number;
  studentsMissingSections: number;
  enrolledStudentIds: string[];
  studentClassDistribution: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  classNames: Record<string, string>;
}

interface AdmissionsSlice {
  applicationsAwaitingAction: number;
  admissionsConfirmed: number;
  enquiriesToday: number;
  pendingEnquiryFollowUps: number;
  applicationsSubmittedToday: number;
  failedAdmissionEvents: number;
  applicationCount: number;
  applicationStatusDistribution: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  recentApplications: Array<
    Omit<AdminDashboardApplication, "updatedAt"> & { updatedAt: string | Date }
  >;
  recentActivity: Array<Omit<AdminDashboardActivity, "occurredAt"> & { occurredAt: string | Date }>;
}

interface IdentitySlice {
  activeStaff: number;
  failedStaffInvites: number;
  recentSecurityChanges: Array<
    Omit<AdminDashboardSecurityChange, "occurredAt"> & { occurredAt: string | Date }
  >;
}

interface FinanceSlice {
  orderStudentIds: string[];
  collectedTodayMinor: number;
  outstandingMinor: number;
  paymentsToday: number;
  unpaidStudents: number;
  failedFinanceEvents: number;
  collectionTrendValues: Record<string, number>;
  collectionByPaymentMethod: AdminDashboardSnapshot["collectionByPaymentMethod"];
  topOutstandingClasses: Array<{
    classId: string;
    studentCount: number;
    outstandingMinor: number;
  }>;
  recentActivity: Array<Omit<AdminDashboardActivity, "occurredAt"> & { occurredAt: string | Date }>;
}

function serviceDate(value: string | Date, field: string) {
  const result = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw new Error(`internal dashboard response contains an invalid ${field}`);
  }
  return result;
}

function required(value: string, field: string) {
  const result = value.trim();
  if (!result) throw new BadRequestError(`${field} is required`);
  return result;
}

function runtimeEnv() {
  return (
    (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

function functionName(key: string) {
  const value = runtimeEnv()[key]?.trim();
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

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
  invoker: InternalServiceInvoker = internalServiceInvoker(),
): Promise<AdminDashboardSnapshot> {
  const owner = required(tenantId, "tenantId");
  const payload = {
    tenantId: owner,
    scope: {
      campusId: scope.campusId,
      academicYearId: scope.academicYearId,
      from: scope.from.toISOString(),
      to: scope.to.toISOString(),
    },
  };
  const [academics, admissions, identity, finance] = await Promise.all([
    invoker.invoke<typeof payload, AcademicsSlice>(functionName("ACADEMICS_FUNCTION_NAME"), {
      operation: "GET_ADMIN_DASHBOARD_SLICE",
      payload,
    }),
    invoker.invoke<typeof payload, AdmissionsSlice>(functionName("ADMISSIONS_FUNCTION_NAME"), {
      operation: "GET_ADMIN_DASHBOARD_SLICE",
      payload,
    }),
    invoker.invoke<typeof payload, IdentitySlice>(functionName("IDENTITY_FUNCTION_NAME"), {
      operation: "GET_ADMIN_DASHBOARD_SLICE",
      payload,
    }),
    invoker.invoke<typeof payload, FinanceSlice>(functionName("FINANCE_FUNCTION_NAME"), {
      operation: "GET_ADMIN_DASHBOARD_SLICE",
      payload,
    }),
  ]);
  const orderOwners = new Set(finance.orderStudentIds);
  const studentsMissingFeeOrders = academics.enrolledStudentIds.filter(
    (id) => !orderOwners.has(id),
  ).length;
  const recentActivity = [...admissions.recentActivity, ...finance.recentActivity]
    .map((item) => ({
      ...item,
      occurredAt: serviceDate(item.occurredAt, "activity timestamp"),
    }))
    .sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )
    .slice(0, 10);
  return {
    activeStudents: academics.activeStudents,
    activeStaff: identity.activeStaff,
    applicationsAwaitingAction: admissions.applicationsAwaitingAction,
    admissionsConfirmed: admissions.admissionsConfirmed,
    collectedTodayMinor: finance.collectedTodayMinor,
    outstandingMinor: finance.outstandingMinor,
    openWorkItems:
      admissions.applicationsAwaitingAction +
      academics.studentsMissingSections +
      studentsMissingFeeOrders,
    studentsMissingSections: academics.studentsMissingSections,
    studentsMissingFeeOrders,
    enquiriesToday: admissions.enquiriesToday,
    pendingEnquiryFollowUps: admissions.pendingEnquiryFollowUps,
    applicationsSubmittedToday: admissions.applicationsSubmittedToday,
    paymentsToday: finance.paymentsToday,
    unpaidStudents: finance.unpaidStudents,
    failedStaffInvites: identity.failedStaffInvites,
    failedFinanceEvents: finance.failedFinanceEvents,
    failedAdmissionEvents: admissions.failedAdmissionEvents,
    applicationCount: admissions.applicationCount,
    applicationStatusDistribution: admissions.applicationStatusDistribution,
    studentClassDistribution: academics.studentClassDistribution,
    admissionsTrend: [],
    collectionTrend: dayPeriods(scope.from, scope.to).map((item) => ({
      ...item,
      value: finance.collectionTrendValues[item.period] ?? 0,
    })),
    collectionByPaymentMethod: finance.collectionByPaymentMethod,
    topOutstandingClasses: finance.topOutstandingClasses.map((row) => ({
      ...row,
      className: academics.classNames[row.classId] ?? "Unknown class",
    })),
    recentSecurityChanges: identity.recentSecurityChanges.map((item) => ({
      ...item,
      occurredAt: serviceDate(item.occurredAt, "security change timestamp"),
    })),
    recentApplications: admissions.recentApplications.map((item) => ({
      ...item,
      updatedAt: serviceDate(item.updatedAt, "application timestamp"),
    })),
    recentActivity,
    generatedAt: new Date(),
  };
}
