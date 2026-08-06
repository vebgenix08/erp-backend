import test from "node:test";
import assert from "node:assert/strict";
import type { StudentEnrolledEventData } from "@school-erp/events";
import { InMemoryFeeConfigurationRepository } from "../../fee-configuration/fee-configuration.repository";
import { generateFeeOrderFromEnrollment } from "../fee-orders.service";
import { InMemoryFeeOrderRepository } from "../fee-orders.repository";

const tenantId = "tenant_alpha";
const student: StudentEnrolledEventData = {
  admissionApplicationId: "application_1",
  studentId: "student_1",
  studentName: "Aarav Sharma",
  registrationNumber: "REG-20262027-00001",
  enrollmentId: "enrollment_1",
  campusId: "campus_main",
  academicYearId: "2026-2027",
  programId: "program_secondary",
  classId: "class_10",
  sectionId: "section_a",
  enrolledAt: "2026-06-01T00:00:00.000Z",
  createdBy: "admission_officer_1",
};

async function configuredRepositories() {
  const configuration = new InMemoryFeeConfigurationRepository();
  const orders = new InMemoryFeeOrderRepository();
  const head = await configuration.createFeeHead(tenantId, "admin_1", {
    name: "Annual Tuition Fee",
    category: "TUITION",
  });
  const schedule = await configuration.createSchedule(tenantId, "admin_1", {
    campusId: student.campusId,
    academicYearId: student.academicYearId,
    name: "Annual collection",
    pattern: "ANNUAL",
    collectionPolicy: "PARTIAL_ALLOWED",
  });
  const structure = await configuration.createStructure(tenantId, "admin_1", {
    campusId: student.campusId,
    academicYearId: student.academicYearId,
    name: "Class 10 Annual Fee",
    components: [{ feeHeadId: head.id, amountMinor: 2_500_001 }],
  });
  await configuration.createMapping(tenantId, "admin_1", {
    campusId: student.campusId,
    academicYearId: student.academicYearId,
    structureId: structure.id,
    scheduleId: schedule.id,
    target: { programId: student.programId, classId: student.classId },
  });
  return { configuration, orders };
}

async function configureTargetCampus(deps: Awaited<ReturnType<typeof configuredRepositories>>) {
  const targetSchedule = await deps.configuration.createSchedule(tenantId, "admin_1", { campusId: "campus_north", academicYearId: student.academicYearId, name: "North annual collection", pattern: "ANNUAL", collectionPolicy: "PARTIAL_ALLOWED" });
  const head = (await deps.configuration.snapshot(tenantId, { campusId: student.campusId, academicYearId: student.academicYearId })).feeHeads[0]!;
  const targetStructure = await deps.configuration.createStructure(tenantId, "admin_1", { campusId: "campus_north", academicYearId: student.academicYearId, name: "North Class 10 Annual Fee", components: [{ feeHeadId: head.id, amountMinor: 3_000_000 }] });
  await deps.configuration.createMapping(tenantId, "admin_1", { campusId: "campus_north", academicYearId: student.academicYearId, structureId: targetStructure.id, scheduleId: targetSchedule.id, target: { programId: student.programId, classId: student.classId } });
}

test("generates a frozen fee order from the active class mapping", async () => {
  const deps = await configuredRepositories();
  const order = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  assert.equal(order.orderNumber, "FEE-20262027-000001");
  assert.equal(order.totalMinor, 2_500_001);
  assert.equal(order.balanceMinor, 2_500_001);
  assert.equal(order.charges.length, 1);
  assert.equal(
    JSON.stringify(order.charges.map((item) => item.amountMinor)),
    JSON.stringify([2_500_001]),
  );
  assert.equal(
    JSON.stringify(order.charges.map((item) => item.label)),
    JSON.stringify(["Annual Tuition Fee"]),
  );
  assert.equal(order.status, "OPEN");
});

test("student enrollment retries do not duplicate fee liability", async () => {
  const deps = await configuredRepositories();
  const first = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  const retry = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  assert.equal(retry.id, first.id);
  assert.equal((await deps.orders.list(tenantId)).length, 1);
});

test("class or section reassignment does not duplicate annual fee liability", async () => {
  const deps = await configuredRepositories();
  const first = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  const reassigned = await generateFeeOrderFromEnrollment(
    { ...student, enrollmentId: "enrollment_2", sectionId: "section_b" },
    tenantId,
    deps,
  );
  assert.equal(reassigned.id, first.id);
  assert.equal((await deps.orders.list(tenantId)).length, 1);
});

test("campus transfer preserves source payment and applies transfer credit to the destination order", async () => {
  const deps = await configuredRepositories();
  const created = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  const stored = await deps.orders.getById(tenantId, created.id);
  if (!stored) throw new Error("fee order was not persisted");
  await deps.orders.replace(tenantId, {
    ...stored,
    paidMinor: 500_000,
    balanceMinor: stored.totalMinor - 500_000,
    status: "PARTIALLY_PAID",
    updatedAt: new Date(),
  });

  await configureTargetCampus(deps);
  const destination=await generateFeeOrderFromEnrollment({...student,transferId:"transfer_1",enrollmentId:"enrollment_transfer",campusId:"campus_north"},tenantId,deps);
  const source=await deps.orders.getById(tenantId,created.id);
  assert.equal(source?.status,"CLOSED");assert.equal(source?.closureReason,"CAMPUS_TRANSFER");assert.equal(source?.closedBalanceMinor,2_000_001);assert.equal(source?.balanceMinor,0);
  assert.equal(destination.totalMinor,3_000_000);assert.equal(destination.transferCreditMinor,500_000);assert.equal(destination.balanceMinor,2_500_000);assert.equal(destination.paidMinor,0);
  assert.equal((await deps.orders.list(tenantId)).length,2);
});

test("campus transfer with an additional fee liability is held for finance review", async () => {
  const deps = await configuredRepositories();
  const created = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  const stored = await deps.orders.getById(tenantId, created.id);
  if (!stored) throw new Error("fee order was not persisted");
  const { id: _id, tenantId: _tenantId, orderNumber: _orderNumber, ...generalInput } = stored;
  await deps.orders.create(tenantId, {
    ...generalInput,
    sourceType: "GENERAL",
    sourceId: "general_charge_1",
    enrollmentId: "general:general_charge_1:student_1",
    structureName: "Examination Fee",
  });

  await assert.rejects(
    () => generateFeeOrderFromEnrollment(
      { ...student, enrollmentId: "enrollment_transfer", campusId: "campus_north" },
      tenantId,
      deps,
    ),
    /additional fee liabilities/,
  );
  assert.equal((await deps.orders.list(tenantId)).length, 2);
});

test("paid additional fees do not block a campus transfer", async () => {
  const deps = await configuredRepositories();
  const created = await generateFeeOrderFromEnrollment(student, tenantId, deps);
  const stored = await deps.orders.getById(tenantId, created.id);
  if (!stored) throw new Error("fee order was not persisted");
  const { id: _id, tenantId: _tenantId, orderNumber: _orderNumber, ...generalInput } = stored;
  await deps.orders.create(tenantId, {
    ...generalInput,
    sourceType: "GENERAL",
    sourceId: "paid_activity_fee",
    enrollmentId: "general:paid_activity_fee:student_1",
    structureName: "Activity Fee",
    paidMinor: generalInput.totalMinor,
    balanceMinor: 0,
    status: "PAID",
  });
  await configureTargetCampus(deps);

  const destination = await generateFeeOrderFromEnrollment(
    { ...student, transferId: "transfer_paid_additional", enrollmentId: "enrollment_transfer", campusId: "campus_north" },
    tenantId,
    deps,
  );

  assert.equal(destination.campusId, "campus_north");
  assert.equal(destination.status, "OPEN");
});

test("rejects enrollment when no active fee mapping exists", async () => {
  const configuration = new InMemoryFeeConfigurationRepository();
  const orders = new InMemoryFeeOrderRepository();
  await assert.rejects(
    () =>
      generateFeeOrderFromEnrollment(student, tenantId, {
        configuration,
        orders,
      }),
    /no active fee mapping/,
  );
  assert.equal((await orders.list(tenantId)).length, 0);
});
