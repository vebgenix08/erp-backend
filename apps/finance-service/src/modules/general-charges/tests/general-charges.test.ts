import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryFeeConfigurationRepository } from "../../fee-configuration/fee-configuration.repository";
import { InMemoryFeeOrderRepository } from "../../fee-orders/fee-orders.repository";
import { InMemoryGeneralChargeRepository } from "../general-charges.repository";
import {
  createGeneralCharge,
  listGeneralCharges,
  retryGeneralCharge,
} from "../general-charges.service";
import { InMemoryPaymentRepository } from "../../payments/payments.repository";
import { collectPayment, getReceipt } from "../../payments/payments.service";

function context(tenantId = "tenant_one"): RequestContext {
  return {
    requestId: "request_1",
    method: "POST",
    path: "/general-charges",
    headers: {},
    query: {},
    body: {},
    params: {},
    tenantContext: { tenantId, source: "x-tenant-id", resolvedAt: new Date() },
    authContext: {
      source: "headers",
      authenticatedAt: new Date(),
      user: {
        id: "finance_admin",
        source: "headers",
        permissions: [
          "finance.general-charge.assign",
          "finance.general-charge.read",
          "finance.payment.collect",
          "finance.receipt.read",
        ],
      },
    },
  };
}

async function setup() {
  const configuration = new InMemoryFeeConfigurationRepository();
  const feeHead = await configuration.createFeeHead("tenant_one", "finance_admin", {
    name: "Annual Sports Day",
    category: "OTHER",
    refundable: false,
  });
  const orders = new InMemoryFeeOrderRepository();
  for (const [studentId, classId, sectionId] of [
    ["student_1", "class_10", "section_a"],
    ["student_2", "class_10", "section_b"],
    ["student_3", "class_11", "section_c"],
  ] as const) {
    await orders.create("tenant_one", {
      sourceType: "ANNUAL",
      sourceId: `enrollment_${studentId}`,
      admissionApplicationId: `application_${studentId}`,
      studentId,
      studentName: `Student ${studentId.slice(-1)}`,
      registrationNumber: `REG-${studentId.slice(-1)}`,
      enrollmentId: `enrollment_${studentId}`,
      campusId: "campus_1",
      academicYearId: "year_2026",
      programId: "program_1",
      classId,
      sectionId,
      mappingId: "mapping_1",
      structureId: "structure_1",
      structureCode: "ANNUAL",
      structureName: "Annual Fee",
      scheduleId: "schedule_1",
      scheduleCode: "ANNUAL",
      scheduleName: "Annual",
      collectionPolicy: "PARTIAL_ALLOWED",
      currency: "INR",
      charges: [],
      totalMinor: 0,
      paidMinor: 0,
      balanceMinor: 0,
      status: "PAID",
      createdBy: "system",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return { configuration, feeHead, orders, charges: new InMemoryGeneralChargeRepository() };
}

test("assigns a general charge to every student in the selected class", async () => {
  const deps = await setup();
  const input = {
    campusId: "campus_1",
    academicYearId: "year_2026",
    name: "Annual Sports Day",
    note: "Collect for the inter-house sports programme.",
    feeHeadId: deps.feeHead.id,
    amountMinor: 25_000,
    collectionPolicy: "FULL_ONLY",
    target: { type: "CLASS", ids: ["class_10"] },
    idempotencyKey: "sports-day-2026-class-10",
  };
  const result = await createGeneralCharge(input, context(), deps);
  assert.equal(result.status, "ASSIGNED");
  assert.equal(result.assignedCount, 2);
  const generalOrders = await deps.orders.list("tenant_one", { sourceType: "GENERAL" });
  assert.equal(generalOrders.length, 2);
  assert.equal(
    generalOrders.every((order) => order.balanceMinor === 25_000),
    true,
  );
  assert.equal(
    generalOrders.every((order) => order.sourceId === result.id),
    true,
  );
  assert.equal(
    generalOrders.every((order) => order.note === input.note),
    true,
  );
  assert.equal(
    generalOrders.every((order) => order.charges[0]?.label === deps.feeHead.name),
    true,
  );
  assert.equal(result.note, input.note);
});

test("repeating an idempotent assignment does not duplicate student liabilities", async () => {
  const deps = await setup();
  const input = {
    campusId: "campus_1",
    academicYearId: "year_2026",
    name: "Laboratory Breakage",
    feeHeadId: deps.feeHead.id,
    amountMinor: 10_000,
    collectionPolicy: "PARTIAL_ALLOWED",
    target: { type: "STUDENT", ids: ["student_1"] },
    idempotencyKey: "breakage-student-1",
  };
  const first = await createGeneralCharge(input, context(), deps);
  const second = await createGeneralCharge(input, context(), deps);
  assert.equal(second.id, first.id);
  assert.equal((await deps.orders.list("tenant_one", { sourceType: "GENERAL" })).length, 1);
});

test("general charge history and student resolution remain tenant isolated", async () => {
  const deps = await setup();
  await assert.rejects(
    () =>
      createGeneralCharge(
        {
          campusId: "campus_1",
          academicYearId: "year_2026",
          name: "Missing Student",
          feeHeadId: deps.feeHead.id,
          amountMinor: 5_000,
          collectionPolicy: "FULL_ONLY",
          target: { type: "STUDENT", ids: ["student_missing"] },
          idempotencyKey: "missing",
        },
        context(),
        deps,
      ),
    /do not have an annual finance projection/,
  );
  assert.equal((await listGeneralCharges({}, context("tenant_two"), deps)).length, 0);
});

test("class assignment considers annual orders beyond the first API page", async () => {
  const deps = await setup();
  for (let index = 4; index <= 30; index += 1) {
    await deps.orders.create("tenant_one", {
      sourceType: "ANNUAL",
      sourceId: `enrollment_student_${index}`,
      admissionApplicationId: `application_student_${index}`,
      studentId: `student_${index}`,
      studentName: `Student ${index}`,
      registrationNumber: `REG-${index}`,
      enrollmentId: `enrollment_student_${index}`,
      campusId: "campus_1",
      academicYearId: "year_2026",
      programId: "program_1",
      classId: index === 30 ? "class_target" : "class_other",
      sectionId: "section_a",
      mappingId: "mapping_1",
      structureId: "structure_1",
      structureCode: "ANNUAL",
      structureName: "Annual Fee",
      scheduleId: "schedule_1",
      scheduleCode: "ANNUAL",
      scheduleName: "Annual",
      collectionPolicy: "PARTIAL_ALLOWED",
      currency: "INR",
      charges: [],
      totalMinor: 0,
      paidMinor: 0,
      balanceMinor: 0,
      status: "PAID",
      createdBy: "system",
      createdAt: new Date(2026, 0, index),
      updatedAt: new Date(2026, 0, index),
    });
  }

  const result = await createGeneralCharge(
    {
      campusId: "campus_1",
      academicYearId: "year_2026",
      name: "Examination Fee",
      feeHeadId: deps.feeHead.id,
      amountMinor: 15_000,
      collectionPolicy: "FULL_ONLY",
      target: { type: "CLASS", ids: ["class_target"] },
      idempotencyKey: "exam-class-target",
    },
    context(),
    deps,
  );

  assert.equal(result.status, "ASSIGNED");
  assert.equal(result.assignedCount, 1);
});

test("additional fee is collected against its fee head and appears on the receipt", async () => {
  const deps = await setup();
  const assignment = await createGeneralCharge(
    {
      campusId: "campus_1",
      academicYearId: "year_2026",
      name: "Term Examination Fee",
      note: "Term examination administration charge",
      feeHeadId: deps.feeHead.id,
      amountMinor: 25_000,
      collectionPolicy: "FULL_ONLY",
      target: { type: "STUDENT", ids: ["student_1"] },
      idempotencyKey: "term-exam-student-1",
    },
    context(),
    deps,
  );
  const order = (await deps.orders.list("tenant_one", { sourceType: "GENERAL" }))[0];
  if (!order) throw new Error("additional fee order was not created");
  const payments = new InMemoryPaymentRepository(deps.orders);
  await assert.rejects(
    () =>
      collectPayment(
        {
          studentId: "student_1",
          method: "UPI",
          reference: "UPI-TERM-EXAM-001",
          allocations: [{ feeOrderId: order.id, amountMinor: 10_000 }],
          idempotencyKey: "term-exam-partial-payment",
        },
        context(),
        { repository: payments },
      ),
    /must clear the full balance/,
  );
  const payment = await collectPayment(
    {
      studentId: "student_1",
      method: "UPI",
      reference: "UPI-TERM-EXAM-002",
      note: "Term examination fee received",
      allocations: [{ feeOrderId: order.id, amountMinor: 25_000 }],
      idempotencyKey: "term-exam-full-payment",
    },
    context(),
    { repository: payments },
  );
  const updated = await deps.orders.getById("tenant_one", order.id);
  assert.equal(updated?.status, "PAID");
  assert.equal(updated?.balanceMinor, 0);
  assert.equal(payment.allocations[0]?.chargeAllocations[0]?.feeHeadId, deps.feeHead.id);
  assert.equal(payment.allocations[0]?.chargeAllocations[0]?.label, deps.feeHead.name);
  const receipt = await getReceipt(payment.id, context(), {
    repository: payments,
    feeOrderRepository: deps.orders,
    receiptBranding: {
      institutionName: "Vebgenix Academy",
      campusName: "Central Campus",
      academicYearName: "2026 - 2027",
      className: "Class 10",
      admissionNumber: "ADM-2026-00001",
      collectedByName: "Finance Officer",
    },
  });
  assert.equal(receipt.allocations[0]?.chargeAllocations[0]?.label, deps.feeHead.name);
  assert.equal(receipt.note, "Term examination fee received");
  assert.equal(assignment.assignedCount, 1);
});

test("failed additional fee assignment can resume without duplicate fee orders", async () => {
  const deps = await setup();
  const input = {
    campusId: "campus_1",
    academicYearId: "year_2026",
    name: "Laboratory Materials Fee",
    feeHeadId: deps.feeHead.id,
    amountMinor: 12_500,
    collectionPolicy: "PARTIAL_ALLOWED" as const,
    target: { type: "STUDENT" as const, ids: ["student_4"] },
    idempotencyKey: "laboratory-materials-student-4",
  };
  await assert.rejects(() => createGeneralCharge(input, context(), deps));
  const failed = (await listGeneralCharges({ status: "FAILED" }, context(), deps))[0];
  if (!failed) throw new Error("failed additional fee assignment was not recorded");
  await deps.orders.create("tenant_one", {
    sourceType: "ANNUAL",
    sourceId: "enrollment_student_4",
    admissionApplicationId: "application_student_4",
    studentId: "student_4",
    studentName: "Student 4",
    registrationNumber: "REG-4",
    enrollmentId: "enrollment_student_4",
    campusId: "campus_1",
    academicYearId: "year_2026",
    programId: "program_1",
    classId: "class_10",
    sectionId: "section_a",
    mappingId: "mapping_1",
    structureId: "structure_1",
    structureCode: "ANNUAL",
    structureName: "Annual Fee",
    scheduleId: "schedule_1",
    scheduleCode: "ANNUAL",
    scheduleName: "Annual",
    collectionPolicy: "PARTIAL_ALLOWED",
    currency: "INR",
    charges: [],
    totalMinor: 0,
    paidMinor: 0,
    balanceMinor: 0,
    status: "PAID",
    createdBy: "system",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const resumed = await retryGeneralCharge(failed.id, context(), deps);
  assert.equal(resumed.status, "ASSIGNED");
  assert.equal(resumed.assignedCount, 1);
  assert.equal((await deps.orders.list("tenant_one", { sourceType: "GENERAL" })).length, 1);
  const repeated = await retryGeneralCharge(failed.id, context(), deps);
  assert.equal(repeated.status, "ASSIGNED");
  assert.equal((await deps.orders.list("tenant_one", { sourceType: "GENERAL" })).length, 1);
});
