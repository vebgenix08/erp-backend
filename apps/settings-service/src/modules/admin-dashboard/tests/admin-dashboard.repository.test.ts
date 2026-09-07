import assert from "node:assert/strict";
import test from "node:test";
import type { InternalServiceInvoker, InternalServiceRequest } from "@school-erp/service-client";
import { readAdminDashboard } from "../admin-dashboard.repository";

class DashboardInvoker implements InternalServiceInvoker {
  invoke<TPayload, TResult>(
    functionName: string,
    _request: InternalServiceRequest<TPayload>,
  ): Promise<TResult> {
    const responses: Record<string, unknown> = {
      academics: {
        activeStudents: 1,
        studentsMissingSections: 0,
        enrolledStudentIds: ["student_1"],
        studentClassDistribution: [{ key: "class_1", label: "Class 1", count: 1 }],
        classNames: { class_1: "Class 1" },
      },
      admissions: {
        applicationsAwaitingAction: 1,
        admissionsConfirmed: 0,
        enquiriesToday: 1,
        pendingEnquiryFollowUps: 0,
        applicationsSubmittedToday: 1,
        failedAdmissionEvents: 0,
        applicationCount: 1,
        applicationStatusDistribution: [{ key: "SUBMITTED", label: "Submitted", count: 1 }],
        recentApplications: [
          {
            id: "application_1",
            studentName: "Aarav Sharma",
            status: "SUBMITTED",
            updatedAt: "2026-08-14T10:00:00.000Z",
          },
        ],
        recentActivity: [
          {
            id: "admission_activity_1",
            occurredAt: "2026-08-14T10:00:00.000Z",
            activity: "Application submitted",
            module: "ADMISSIONS",
            subject: "Aarav Sharma",
            performedBy: "Admissions Office",
            status: "SUBMITTED",
          },
        ],
      },
      identity: {
        activeStaff: 1,
        failedStaffInvites: 0,
        recentSecurityChanges: [
          {
            id: "security_1",
            change: "Role assigned",
            subject: "Aarav Sharma",
            occurredAt: "2026-08-14T11:00:00.000Z",
            status: "ACTIVE",
          },
        ],
      },
      finance: {
        orderStudentIds: ["student_1"],
        collectedTodayMinor: 10000,
        outstandingMinor: 0,
        paymentsToday: 1,
        unpaidStudents: 0,
        failedFinanceEvents: 0,
        collectionTrendValues: { "2026-08-14": 10000 },
        collectionByPaymentMethod: [{ method: "UPI", paymentCount: 1, amountMinor: 10000 }],
        topOutstandingClasses: [],
        recentActivity: [
          {
            id: "finance_activity_1",
            occurredAt: "2026-08-14T12:00:00.000Z",
            activity: "Payment collected",
            module: "FINANCE",
            subject: "Aarav Sharma",
            performedBy: "Accounts Office",
            status: "SUCCESS",
          },
        ],
      },
    };
    return Promise.resolve(responses[functionName] as TResult);
  }
}

test("dashboard converts serialized service timestamps into domain dates", async () => {
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
    .process.env;
  env.ACADEMICS_FUNCTION_NAME = "academics";
  env.ADMISSIONS_FUNCTION_NAME = "admissions";
  env.IDENTITY_FUNCTION_NAME = "identity";
  env.FINANCE_FUNCTION_NAME = "finance";

  const result = await readAdminDashboard(
    "tenant_1",
    {
      campusId: "campus_1",
      academicYearId: "academic_year_1",
      from: new Date("2026-08-14T00:00:00.000Z"),
      to: new Date("2026-08-14T23:59:59.000Z"),
    },
    new DashboardInvoker(),
  );

  assert.ok(result.recentApplications[0]?.updatedAt instanceof Date);
  assert.ok(result.recentSecurityChanges[0]?.occurredAt instanceof Date);
  assert.ok(result.recentActivity.every((item) => item.occurredAt instanceof Date));
  assert.equal(result.recentActivity[0]?.id, "finance_activity_1");
});
