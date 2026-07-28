import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryFeeOrderRepository } from "../../fee-orders/fee-orders.repository";
import { InMemoryPaymentRepository } from "../../payments/payments.repository";
import {
  createPaymentAdjustment,
  listPaymentAdjustments,
} from "../payment-adjustments.service";
import { InMemoryPaymentAdjustmentRepository } from "../payment-adjustments.repository";

function context(tenantId = "tenant_one"): RequestContext {
  return {
    requestId: "request",
    method: "POST",
    path: "/adjustments",
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
        permissions: [
          "finance.payment-adjustment.read",
          "finance.payment.void",
          "finance.payment.refund",
        ],
        source: "headers",
      },
    },
  };
}

async function setup(refundable = true) {
  const orders = new InMemoryFeeOrderRepository();
  const at = new Date("2026-06-01T00:00:00.000Z");
  const order = await orders.create("tenant_one", {
    admissionApplicationId: "application_1",
    studentId: "student_1",
    studentName: "Aarav Sharma",
    registrationNumber: "REG-2026-0001",
    enrollmentId: "enrollment_1",
    campusId: "campus_1",
    academicYearId: "year_2026",
    programId: "program_1",
    classId: "class_10",
    mappingId: "mapping_1",
    structureId: "structure_1",
    structureCode: "FST-0001",
    structureName: "Class 10 Fee",
    scheduleId: "schedule_1",
    scheduleCode: "FS-0001",
    scheduleName: "Annual",
    collectionPolicy: "PARTIAL_ALLOWED",
    currency: "INR",
    charges: [
      {
        id: "charge_1",
        feeHeadId: "head_1",
        feeHeadCode: "FH-0001",
        label: "Caution Deposit",
        refundable,
        sequence: 1,
        amountMinor: 100_000,
        paidMinor: 0,
        balanceMinor: 100_000,
      },
    ],
    totalMinor: 100_000,
    paidMinor: 0,
    balanceMinor: 100_000,
    status: "OPEN",
    createdBy: "admin",
    createdAt: at,
    updatedAt: at,
  });
  const payments = new InMemoryPaymentRepository(orders);
  const payment = await payments.collect("tenant_one", "cashier", {
    studentId: "student_1",
    method: "UPI",
    idempotencyKey: "collect_1",
    allocations: [{ feeOrderId: order.id, amountMinor: 100_000 }],
  });
  const adjustments = new InMemoryPaymentAdjustmentRepository(payments, orders);
  return {
    orders,
    payments,
    payment,
    adjustments,
    deps: {
      orders,
      payments,
      adjustments,
      now: () => new Date("2026-06-02T00:00:00.000Z"),
    },
  };
}

test("void creates an immutable adjustment and restores the fee order", async () => {
  const state = await setup();
  const result = await createPaymentAdjustment(
    {
      paymentId: state.payment.id,
      type: "VOID",
      reason: "Incorrect payment was recorded",
      idempotencyKey: "void_1",
    },
    context(),
    state.deps,
  );
  assert.equal(result.adjustmentNumber, "ADJ-YEAR2026-000001");
  assert.equal(result.amountMinor, 100_000);
  assert.equal(
    (await state.payments.getById("tenant_one", state.payment.id))?.status,
    "VOIDED",
  );
  const order = await state.orders.getById(
    "tenant_one",
    state.payment.allocations[0]!.feeOrderId,
  );
  assert.equal(order?.paidMinor, 0);
  assert.equal(order?.balanceMinor, 100_000);
  assert.equal(order?.status, "OPEN");
});

test("partial refund restores only the recorded refundable amount", async () => {
  const state = await setup();
  const result = await createPaymentAdjustment(
    {
      paymentId: state.payment.id,
      type: "REFUND",
      amountMinor: 40_000,
      reason: "Approved refundable deposit return",
      idempotencyKey: "refund_1",
    },
    context(),
    state.deps,
  );
  assert.equal(result.amountMinor, 40_000);
  const payment = await state.payments.getById("tenant_one", state.payment.id);
  assert.equal(payment?.status, "PARTIALLY_REFUNDED");
  assert.equal(payment?.reversedMinor, 40_000);
  const order = await state.orders.getById(
    "tenant_one",
    state.payment.allocations[0]!.feeOrderId,
  );
  assert.equal(order?.paidMinor, 60_000);
  assert.equal(order?.balanceMinor, 40_000);
});

test("refund rejects non-refundable charge and duplicate request is idempotent", async () => {
  const blocked = await setup(false);
  await assert.rejects(
    () =>
      createPaymentAdjustment(
        {
          paymentId: blocked.payment.id,
          type: "REFUND",
          amountMinor: 1,
          reason: "Requested refund is not eligible",
          idempotencyKey: "refund_blocked",
        },
        context(),
        blocked.deps,
      ),
    /remaining refundable/,
  );
  const state = await setup();
  const input = {
    paymentId: state.payment.id,
    type: "REFUND",
    amountMinor: 25_000,
    reason: "Approved refundable deposit return",
    idempotencyKey: "refund_same",
  };
  const first = await createPaymentAdjustment(input, context(), state.deps);
  const retry = await createPaymentAdjustment(input, context(), state.deps);
  assert.equal(retry.id, first.id);
  assert.equal(
    (
      await listPaymentAdjustments(
        { paymentId: state.payment.id },
        context(),
        state.deps,
      )
    ).length,
    1,
  );
});

test("adjustment lookup and mutation are tenant isolated", async () => {
  const state = await setup();
  await assert.rejects(
    () =>
      createPaymentAdjustment(
        {
          paymentId: state.payment.id,
          type: "VOID",
          reason: "Incorrect payment was recorded",
          idempotencyKey: "void_other",
        },
        context("tenant_two"),
        state.deps,
      ),
    /not found/,
  );
  assert.equal(
    (await listPaymentAdjustments({}, context("tenant_two"), state.deps))
      .length,
    0,
  );
});
