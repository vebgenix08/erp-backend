import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryFeeOrderRepository } from "../../fee-orders/fee-orders.repository";
import { InMemoryPaymentRepository } from "../payments.repository";
import { collectPayment, getReceipt, getReceiptDocument } from "../payments.service";
import { InMemoryReceiptTemplateRepository } from "../../receipt-template/receipt-template.repository";

function context(tenantId = "tenant_one"): RequestContext {
  return {
    requestId: "request",
    method: "POST",
    path: "/payments",
    headers: {},
    query: {},
    body: {},
    params: {},
    tenantContext: { tenantId, source: "x-tenant-id", resolvedAt: new Date() },
    authContext: {
      source: "headers",
      authenticatedAt: new Date(),
      user: {
        id: "cashier_1",
        permissions: [
          "finance.payment.collect",
          "finance.payment.read",
          "finance.receipt.read",
        ],
        source: "headers",
      },
    },
  };
}

async function repositories(
  collectionPolicy: "FULL_ONLY" | "PARTIAL_ALLOWED" = "PARTIAL_ALLOWED",
) {
  const orders = new InMemoryFeeOrderRepository();
  const at = new Date("2026-06-01T00:00:00.000Z");
  const order = await orders.create("tenant_one", {
    admissionApplicationId: "application_1",
    studentId: "student_1",
    studentName: "Aarav Sharma",
    registrationNumber: "REG-20262027-00001",
    enrollmentId: "enrollment_1",
    campusId: "campus_1",
    academicYearId: "year_2026",
    programId: "program_1",
    classId: "class_10",
    mappingId: "mapping_1",
    structureId: "structure_1",
    structureCode: "FST-0001",
    structureName: "Class 10 Annual Fee",
    scheduleId: "schedule_1",
    scheduleCode: "FS-0001",
    scheduleName: "Annual Full Payment",
    collectionPolicy,
    currency: "INR",
    charges: [
      {
        id: "charge_1",
        feeHeadId: "head_1",
        feeHeadCode: "FH-0001",
        label: "Annual Tuition Fee",
        refundable: true,
        sequence: 1,
        amountMinor: 250_000,
        paidMinor: 0,
        balanceMinor: 250_000,
      },
    ],
    totalMinor: 250_000,
    paidMinor: 0,
    balanceMinor: 250_000,
    status: "OPEN",
    createdBy: "admin_1",
    createdAt: at,
    updatedAt: at,
  });
  return { orders, order, payments: new InMemoryPaymentRepository(orders) };
}

function input(orderId: string, amountMinor = 250_000) {
  return {
    studentId: "student_1",
    method: "UPI" as const,
    reference: "UPI-2026-001",
    idempotencyKey: "payment-request-1",
    allocations: [{ feeOrderId: orderId, amountMinor }],
  };
}

test("backend derives receipt identity and payment data from the fee order", async () => {
  const { orders, order, payments } = await repositories();
  const payment = await collectPayment(input(order.id), context(), {
    repository: payments,
  });
  assert.equal(payment.receiptNumber, "RCP-YEAR2026-000001");
  assert.equal(payment.studentName, "Aarav Sharma");
  assert.equal(payment.amountMinor, 250_000);
  assert.equal(
    payment.allocations[0]?.label,
    `${order.orderNumber} · Class 10 Annual Fee`,
  );
  const receipt = await getReceipt(payment.id, context(), {
    repository: payments,
    feeOrderRepository: orders,
  });
  assert.equal(receipt.student.name, "Aarav Sharma");
  assert.equal(receipt.amountMinor, 250_000);
  assert.equal(receipt.documentHtml.includes("Aarav Sharma"), true);
  assert.equal(receipt.documentHtml.includes("Class 10 Annual Fee"), true);
  assert.equal(receipt.documentHtml.includes("Amount in words"), true);
  assert.equal(receipt.documentHtml.includes("Mode:"), true);
  assert.equal(receipt.documentHtml.includes("Balance"), true);
  assert.equal(receipt.fileName, "RCP-YEAR2026-000001.pdf");
  const document = await getReceiptDocument(payment.id, context(), {
    repository: payments,
    feeOrderRepository: orders,
  });
  const twoCopyDocument = await getReceiptDocument(
    payment.id,
    context(),
    {
      repository: payments,
      feeOrderRepository: orders,
    },
    "BOTH",
  );
  assert.equal(document.contentType, "application/pdf");
  assert.equal(new TextDecoder().decode(document.bytes.subarray(0, 4)), "%PDF");
  assert.equal(
    new TextDecoder().decode(twoCopyDocument.bytes.subarray(0, 4)),
    "%PDF",
  );
  assert.equal(twoCopyDocument.bytes.byteLength > document.bytes.byteLength, true);
  assert.equal((await orders.getById("tenant_one", order.id))?.status, "PAID");
  assert.equal((await orders.getById("tenant_one", order.id))?.balanceMinor, 0);
});

test("partial collection updates the authoritative order balance", async () => {
  const { orders, order, payments } = await repositories();
  await collectPayment(input(order.id, 100_000), context(), {
    repository: payments,
  });
  const updated = await orders.getById("tenant_one", order.id);
  assert.equal(updated?.status, "PARTIALLY_PAID");
  assert.equal(updated?.paidMinor, 100_000);
  assert.equal(updated?.balanceMinor, 150_000);
});

test("allocates partial payments by fee-head priority and keeps one order open", async () => {
  const orders = new InMemoryFeeOrderRepository();
  const at = new Date("2026-06-01T00:00:00.000Z");
  const order = await orders.create("tenant_one", {
    admissionApplicationId: "application_2",
    studentId: "student_1",
    studentName: "Aarav Sharma",
    registrationNumber: "REG-20262027-00001",
    enrollmentId: "enrollment_2",
    campusId: "campus_1",
    academicYearId: "year_2026",
    programId: "program_1",
    classId: "class_1",
    mappingId: "mapping_2",
    structureId: "structure_2",
    structureCode: "FST-0002",
    structureName: "Class 1 Annual Fee",
    scheduleId: "schedule_2",
    scheduleCode: "FS-0002",
    scheduleName: "Annual collection",
    collectionPolicy: "PARTIAL_ALLOWED",
    currency: "INR",
    charges: [
      {
        id: "admission_charge",
        feeHeadId: "admission_head",
        feeHeadCode: "FH-0001",
        label: "Admission Fee",
        refundable: false,
        sequence: 1,
        amountMinor: 500_000,
        paidMinor: 0,
        balanceMinor: 500_000,
      },
      {
        id: "tuition_charge",
        feeHeadId: "tuition_head",
        feeHeadCode: "FH-0002",
        label: "Tuition Fee",
        refundable: false,
        sequence: 2,
        amountMinor: 2_000_000,
        paidMinor: 0,
        balanceMinor: 2_000_000,
      },
      {
        id: "exam_charge",
        feeHeadId: "exam_head",
        feeHeadCode: "FH-0003",
        label: "Examination Fee",
        refundable: false,
        sequence: 3,
        amountMinor: 200_000,
        paidMinor: 0,
        balanceMinor: 200_000,
      },
    ],
    totalMinor: 2_700_000,
    paidMinor: 0,
    balanceMinor: 2_700_000,
    status: "OPEN",
    createdBy: "admin_1",
    createdAt: at,
    updatedAt: at,
  });
  const payments = new InMemoryPaymentRepository(orders);
  const payment = await collectPayment(
    {
      studentId: "student_1",
      method: "CASH",
      note: "Annual fee part payment received at the accounts office",
      idempotencyKey: "annual-payment-1",
      allocations: [{ feeOrderId: order.id, amountMinor: 1_000_000 }],
    },
    context(),
    { repository: payments },
  );
  assert.equal(
    JSON.stringify(
      payment.allocations[0]?.chargeAllocations.map((item) => [
        item.label,
        item.amountMinor,
      ]),
    ),
    JSON.stringify([
      ["Admission Fee", 500_000],
      ["Tuition Fee", 500_000],
    ]),
  );
  assert.equal(payment.note, "Annual fee part payment received at the accounts office");
  const updated = await orders.getById("tenant_one", order.id);
  assert.equal(updated?.status, "PARTIALLY_PAID");
  assert.equal(updated?.balanceMinor, 1_700_000);
  assert.equal(updated?.charges[0]?.balanceMinor, 0);
  assert.equal(updated?.charges[1]?.balanceMinor, 1_500_000);
  assert.equal(updated?.charges[2]?.balanceMinor, 200_000);
});

test("supports validated manual fee-head allocation", async () => {
  const { orders, order, payments } = await repositories();
  const payment = await collectPayment(
    {
      ...input(order.id, 100_000),
      allocations: [
        {
          feeOrderId: order.id,
          amountMinor: 100_000,
          chargeAllocations: [{ chargeId: "charge_1", amountMinor: 100_000 }],
        },
      ],
    },
    context(),
    { repository: payments },
  );
  assert.equal(
    payment.allocations[0]?.chargeAllocations[0]?.amountMinor,
    100_000,
  );
  await assert.rejects(
    () =>
      collectPayment(
        {
          ...input(order.id, 50_000),
          idempotencyKey: "invalid-manual-allocation",
          allocations: [
            {
              feeOrderId: order.id,
              amountMinor: 50_000,
              chargeAllocations: [
                { chargeId: "charge_1", amountMinor: 50_001 },
              ],
            },
          ],
        },
        context(),
        { repository: payments },
      ),
    /charge allocation total must equal/,
  );
  assert.equal((await orders.getById("tenant_one", order.id))?.paidMinor, 100_000);
});

test("receipt PDF consumes the saved tenant receipt template", async () => {
  const { orders, order, payments } = await repositories();
  const templates = new InMemoryReceiptTemplateRepository();
  const payment = await collectPayment(input(order.id), context(), {
    repository: payments,
  });
  const defaultDocument = await getReceiptDocument(payment.id, context(), {
    repository: payments,
    feeOrderRepository: orders,
    receiptTemplateRepository: templates,
  });
  await templates.save("tenant_one", "finance_admin", {
    title: "Official Collection Receipt",
    headerText: "Payment acknowledged by the institution",
    footerText: "Retain this receipt for institutional records.",
    signatureLabel: "Finance Officer",
    paperSize: "A4",
    accentColor: "#8B1E3F",
    showInstitutionLogo: true,
    showInstitutionAddress: true,
    showPaymentMethod: true,
    showPaymentReference: false,
  });
  const configuredDocument = await getReceiptDocument(payment.id, context(), {
    repository: payments,
    feeOrderRepository: orders,
    receiptTemplateRepository: templates,
  });
  assert.equal(
    configuredDocument.bytes.byteLength !== defaultDocument.bytes.byteLength,
    true,
  );
});

test("full-only collection policy rejects a partial payment", async () => {
  const { order, payments } = await repositories("FULL_ONLY");
  await assert.rejects(
    () =>
      collectPayment(input(order.id, 100_000), context(), {
        repository: payments,
      }),
    /must clear the full balance/,
  );
});

test("idempotent collection does not reduce the balance twice", async () => {
  const { orders, order, payments } = await repositories();
  const first = await collectPayment(input(order.id, 100_000), context(), {
    repository: payments,
  });
  const second = await collectPayment(input(order.id, 100_000), context(), {
    repository: payments,
  });
  assert.equal(second.id, first.id);
  assert.equal(
    (await orders.getById("tenant_one", order.id))?.balanceMinor,
    150_000,
  );
});

test("rejects overpayment and unknown fee orders", async () => {
  const { order, payments } = await repositories();
  await assert.rejects(
    () =>
      collectPayment(input(order.id, 250_001), context(), {
        repository: payments,
      }),
    /exceeds the balance/,
  );
  await assert.rejects(
    () =>
      collectPayment(input("fee_order_missing", 1), context(), {
        repository: payments,
      }),
    /not found/,
  );
});

test("receipt lookup is tenant isolated", async () => {
  const { order, payments } = await repositories();
  const payment = await collectPayment(input(order.id), context(), {
    repository: payments,
  });
  await assert.rejects(
    () =>
      getReceipt(payment.id, context("tenant_two"), { repository: payments }),
    /not found/,
  );
});

test("requires a traceable reference for non-cash payments", async () => {
  const { order, payments } = await repositories();
  const payment = input(order.id);
  delete (payment as Partial<typeof payment>).reference;
  await assert.rejects(
    () => collectPayment(payment, context(), { repository: payments }),
    /reference is required for upi payments/,
  );
});

test("allows cash collection without a transaction reference", async () => {
  const { order, payments } = await repositories();
  const payment = { ...input(order.id), method: "CASH" as const };
  delete (payment as Partial<typeof payment>).reference;
  const collected = await collectPayment(payment, context(), {
    repository: payments,
  });
  assert.equal(collected.method, "CASH");
  assert.equal(collected.reference, undefined);
});
