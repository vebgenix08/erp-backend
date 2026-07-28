import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryFeeConfigurationRepository } from "../../fee-configuration/fee-configuration.repository";
import { InMemoryFeeOrderRepository } from "../../fee-orders/fee-orders.repository";
import { InMemoryGeneralChargeRepository } from "../general-charges.repository";
import { createGeneralCharge, listGeneralCharges } from "../general-charges.service";

function context(tenantId = "tenant_one"): RequestContext {
  return {
    requestId: "request_1", method: "POST", path: "/general-charges", headers: {}, query: {}, body: {}, params: {},
    tenantContext: { tenantId, source: "x-tenant-id", resolvedAt: new Date() },
    authContext: { source: "headers", authenticatedAt: new Date(), user: { id: "finance_admin", source: "headers", permissions: ["finance.general-charge.assign", "finance.general-charge.read"] } },
  };
}

async function setup() {
  const configuration = new InMemoryFeeConfigurationRepository();
  const feeHead = await configuration.createFeeHead("tenant_one", "finance_admin", { name: "Annual Sports Day", category: "OTHER", refundable: false });
  const orders = new InMemoryFeeOrderRepository();
  for (const [studentId, classId, sectionId] of [["student_1", "class_10", "section_a"], ["student_2", "class_10", "section_b"], ["student_3", "class_11", "section_c"]] as const) {
    await orders.create("tenant_one", {
      sourceType: "ANNUAL", sourceId: `enrollment_${studentId}`, admissionApplicationId: `application_${studentId}`, studentId, studentName: `Student ${studentId.slice(-1)}`, registrationNumber: `REG-${studentId.slice(-1)}`, enrollmentId: `enrollment_${studentId}`, campusId: "campus_1", academicYearId: "year_2026", programId: "program_1", classId, sectionId, mappingId: "mapping_1", structureId: "structure_1", structureCode: "ANNUAL", structureName: "Annual Fee", scheduleId: "schedule_1", scheduleCode: "ANNUAL", scheduleName: "Annual", collectionPolicy: "PARTIAL_ALLOWED", currency: "INR", charges: [], totalMinor: 0, paidMinor: 0, balanceMinor: 0, status: "PAID", createdBy: "system", createdAt: new Date(), updatedAt: new Date(),
    });
  }
  return { configuration, feeHead, orders, charges: new InMemoryGeneralChargeRepository() };
}

test("assigns a general charge to every student in the selected class", async () => {
  const deps = await setup();
  const input = { campusId: "campus_1", academicYearId: "year_2026", name: "Annual Sports Day", note: "Collect for the inter-house sports programme.", feeHeadId: deps.feeHead.id, amountMinor: 25_000, collectionPolicy: "FULL_ONLY", target: { type: "CLASS", ids: ["class_10"] }, idempotencyKey: "sports-day-2026-class-10" };
  const result = await createGeneralCharge(input, context(), deps);
  assert.equal(result.status, "ASSIGNED");
  assert.equal(result.assignedCount, 2);
  const generalOrders = await deps.orders.list("tenant_one", { sourceType: "GENERAL" });
  assert.equal(generalOrders.length, 2);
  assert.equal(generalOrders.every((order) => order.balanceMinor === 25_000), true);
  assert.equal(generalOrders.every((order) => order.sourceId === result.id), true);
  assert.equal(generalOrders.every((order) => order.note === input.note), true);
  assert.equal(generalOrders.every((order) => order.charges[0]?.label === deps.feeHead.name), true);
  assert.equal(result.note, input.note);
});

test("repeating an idempotent assignment does not duplicate student liabilities", async () => {
  const deps = await setup();
  const input = { campusId: "campus_1", academicYearId: "year_2026", name: "Laboratory Breakage", feeHeadId: deps.feeHead.id, amountMinor: 10_000, collectionPolicy: "PARTIAL_ALLOWED", target: { type: "STUDENT", ids: ["student_1"] }, idempotencyKey: "breakage-student-1" };
  const first = await createGeneralCharge(input, context(), deps);
  const second = await createGeneralCharge(input, context(), deps);
  assert.equal(second.id, first.id);
  assert.equal((await deps.orders.list("tenant_one", { sourceType: "GENERAL" })).length, 1);
});

test("general charge history and student resolution remain tenant isolated", async () => {
  const deps = await setup();
  await assert.rejects(() => createGeneralCharge({ campusId: "campus_1", academicYearId: "year_2026", name: "Missing Student", feeHeadId: deps.feeHead.id, amountMinor: 5_000, collectionPolicy: "FULL_ONLY", target: { type: "STUDENT", ids: ["student_missing"] }, idempotencyKey: "missing" }, context(), deps), /do not have an annual finance projection/);
  assert.equal((await listGeneralCharges({}, context("tenant_two"), deps)).length, 0);
});

test("class assignment considers annual orders beyond the first API page", async () => {
  const deps = await setup();
  for (let index = 4; index <= 30; index += 1) {
    await deps.orders.create("tenant_one", {
      sourceType: "ANNUAL", sourceId: `enrollment_student_${index}`, admissionApplicationId: `application_student_${index}`,
      studentId: `student_${index}`, studentName: `Student ${index}`, registrationNumber: `REG-${index}`,
      enrollmentId: `enrollment_student_${index}`, campusId: "campus_1", academicYearId: "year_2026",
      programId: "program_1", classId: index === 30 ? "class_target" : "class_other", sectionId: "section_a",
      mappingId: "mapping_1", structureId: "structure_1", structureCode: "ANNUAL", structureName: "Annual Fee",
      scheduleId: "schedule_1", scheduleCode: "ANNUAL", scheduleName: "Annual", collectionPolicy: "PARTIAL_ALLOWED",
      currency: "INR", charges: [], totalMinor: 0, paidMinor: 0, balanceMinor: 0, status: "PAID",
      createdBy: "system", createdAt: new Date(2026, 0, index), updatedAt: new Date(2026, 0, index),
    });
  }

  const result = await createGeneralCharge({
    campusId: "campus_1", academicYearId: "year_2026", name: "Examination Fee",
    feeHeadId: deps.feeHead.id, amountMinor: 15_000, collectionPolicy: "FULL_ONLY",
    target: { type: "CLASS", ids: ["class_target"] }, idempotencyKey: "exam-class-target",
  }, context(), deps);

  assert.equal(result.status, "ASSIGNED");
  assert.equal(result.assignedCount, 1);
});
