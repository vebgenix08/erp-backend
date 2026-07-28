import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import type { StudentEnrolledEventData } from "@school-erp/events";
import { InMemoryFeeOrderRecoveryRepository } from "../fee-order-recovery.repository";
import {
  listFeeOrderRecoveries,
  recordFeeOrderFailure,
  retryFeeOrderRecovery,
} from "../fee-order-recovery.service";

const payload: StudentEnrolledEventData = {
  admissionApplicationId: "application_1",
  studentId: "student_1",
  studentName: "Aarav Sharma",
  registrationNumber: "REG-2026-0001",
  enrollmentId: "enrollment_1",
  campusId: "campus_1",
  academicYearId: "year_1",
  programId: "program_1",
  classId: "class_10",
  enrolledAt: "2026-06-01T00:00:00.000Z",
  createdBy: "admission_officer",
};
const context = (tenantId = "tenant_one"): RequestContext => ({
  requestId: "request",
  method: "POST",
  path: "/recoveries",
  headers: {},
  query: {},
  body: {},
  params: {},
  tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
  authContext: {
    source: "jwt-claims",
    authenticatedAt: new Date(),
    user: {
      id: "finance_admin",
      permissions: [
        "finance.fee-order-recovery.read",
        "finance.fee-order-recovery.retry",
      ],
      source: "jwt-claims",
    },
  },
});
test("records an event failure once and increments attempts", async () => {
  const repository = new InMemoryFeeOrderRecoveryRepository(),
    deps = { repository };
  await recordFeeOrderFailure(
    "tenant_one",
    "event_1",
    payload,
    new Error("No active mapping"),
    deps,
  );
  await recordFeeOrderFailure(
    "tenant_one",
    "event_1",
    payload,
    new Error("Still no mapping"),
    deps,
  );
  const rows = await listFeeOrderRecoveries({}, context(), deps);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.attempts, 2);
  assert.equal(rows[0]?.lastError, "Still no mapping");
});
test("retry resolves recovery after fee order generation succeeds", async () => {
  const repository = new InMemoryFeeOrderRecoveryRepository();
  const pending = await recordFeeOrderFailure(
    "tenant_one",
    "event_1",
    payload,
    new Error("No active mapping"),
    { repository },
  );
  let generated = 0;
  const result = await retryFeeOrderRecovery(pending.id, context(), {
    repository,
    generate: async () => {
      generated++;
    },
  });
  assert.equal(generated, 1);
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.resolvedBy, "finance_admin");
});
test("failed retry remains pending and tenant isolation is enforced", async () => {
  const repository = new InMemoryFeeOrderRecoveryRepository();
  const pending = await recordFeeOrderFailure(
    "tenant_one",
    "event_1",
    payload,
    new Error("No active mapping"),
    { repository },
  );
  await assert.rejects(
    () =>
      retryFeeOrderRecovery(pending.id, context(), {
        repository,
        generate: async () => {
          throw new Error("Mapping still missing");
        },
      }),
    /Mapping still missing/,
  );
  const rows = await listFeeOrderRecoveries({ status: "PENDING" }, context(), {
    repository,
  });
  assert.equal(rows[0]?.attempts, 2);
  assert.equal(
    (await listFeeOrderRecoveries({}, context("tenant_two"), { repository }))
      .length,
    0,
  );
});
