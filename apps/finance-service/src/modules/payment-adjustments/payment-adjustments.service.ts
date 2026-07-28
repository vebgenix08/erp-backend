import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@school-erp/errors";
import type { FeeOrderRecord } from "../fee-orders/fee-orders.model";
import {
  feeOrderRepository,
  type FeeOrderRepository,
} from "../fee-orders/fee-orders.repository";
import {
  paymentRepository,
  type PaymentRepository,
} from "../payments/payments.repository";
import { toPaymentAdjustmentView } from "./payment-adjustments.mapper";
import type {
  PaymentAdjustmentAllocation,
  PaymentAdjustmentFilter,
  PaymentAdjustmentRecord,
} from "./payment-adjustments.model";
import { paymentAdjustmentPermissions } from "./payment-adjustments.permissions";
import {
  paymentAdjustmentRepository,
  type PaymentAdjustmentRepository,
} from "./payment-adjustments.repository";
import {
  validatePaymentAdjustment,
  validatePaymentAdjustmentFilter,
} from "./payment-adjustments.validator";

export interface PaymentAdjustmentDependencies {
  payments?: PaymentRepository | Promise<PaymentRepository>;
  orders?: FeeOrderRepository | Promise<FeeOrderRepository>;
  adjustments?:
    | PaymentAdjustmentRepository
    | Promise<PaymentAdjustmentRepository>;
  now?: () => Date;
}
const tenantId = (context: RequestContext) => {
  const value = context.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
};
const actorId = (context: RequestContext) => {
  const value = context.authContext?.user?.id?.trim();
  if (!value) throw new ForbiddenError("authenticated user is required");
  return value;
};
const requirePermission = (context: RequestContext, permission: Permission) => {
  if (!(context.authContext?.user?.permissions ?? []).includes(permission))
    throw new ForbiddenError(`permission ${permission} is required`);
};
const payments = async (deps?: PaymentAdjustmentDependencies) =>
  await (deps?.payments ?? paymentRepository());
const orders = async (deps?: PaymentAdjustmentDependencies) =>
  await (deps?.orders ?? feeOrderRepository());
const adjustments = async (deps?: PaymentAdjustmentDependencies) =>
  await (deps?.adjustments ?? paymentAdjustmentRepository());

export async function createPaymentAdjustment(
  input: unknown,
  context: RequestContext,
  deps: PaymentAdjustmentDependencies = {},
) {
  const value = validatePaymentAdjustment(input);
  requirePermission(
    context,
    (value.type === "VOID"
      ? paymentAdjustmentPermissions.void
      : paymentAdjustmentPermissions.refund) as Permission,
  );
  const tenant = tenantId(context);
  const adjustmentStore = await adjustments(deps);
  const idempotent = await adjustmentStore.getByIdempotencyKey(
    tenant,
    value.idempotencyKey,
  );
  if (idempotent) return toPaymentAdjustmentView(idempotent);
  const payment = await (await payments(deps)).getById(tenant, value.paymentId);
  if (!payment) throw new NotFoundError("payment was not found");
  const reversedMinor = payment.reversedMinor ?? 0;
  const remainingMinor = payment.amountMinor - reversedMinor;
  if (
    remainingMinor <= 0 ||
    payment.status === "VOIDED" ||
    payment.status === "REFUNDED"
  )
    throw new ConflictError("payment has already been fully reversed");
  if (value.type === "VOID" && reversedMinor > 0)
    throw new ConflictError("a partially refunded payment cannot be voided");
  if (
    payment.allocations.some(
      (allocation) => !allocation.chargeAllocations?.length,
    )
  )
    throw new ConflictError(
      "this legacy payment has no charge-level ledger and requires manual finance review",
    );
  const orderRepository = await orders(deps);
  const orderMap = new Map<string, FeeOrderRecord>();
  for (const allocation of payment.allocations) {
    const order = await orderRepository.getById(tenant, allocation.feeOrderId);
    if (!order)
      throw new ConflictError("payment references a missing fee order");
    orderMap.set(order.id, order);
  }
  const prior = await adjustmentStore.list(tenant, { paymentId: payment.id });
  const alreadyReversed = new Map<string, number>();
  for (const record of prior)
    for (const allocation of record.allocations)
      alreadyReversed.set(
        allocation.chargeId,
        (alreadyReversed.get(allocation.chargeId) ?? 0) +
          allocation.amountMinor,
      );
  const candidates = payment.allocations
    .flatMap((allocation) =>
      allocation.chargeAllocations.map((charge) => ({
        ...charge,
        feeOrderId: allocation.feeOrderId,
        remainingMinor:
          charge.amountMinor - (alreadyReversed.get(charge.chargeId) ?? 0),
      })),
    )
    .filter((item) => item.remainingMinor > 0)
    .reverse();
  const eligible =
    value.type === "VOID"
      ? candidates
      : candidates.filter(
          (item) =>
            orderMap
              .get(item.feeOrderId)
              ?.charges.find((charge) => charge.id === item.chargeId)
              ?.refundable === true,
        );
  const requestedMinor =
    value.type === "VOID" ? remainingMinor : value.amountMinor!;
  const eligibleMinor = eligible.reduce(
    (sum, item) => sum + item.remainingMinor,
    0,
  );
  if (requestedMinor > eligibleMinor)
    throw new ConflictError(
      value.type === "REFUND"
        ? "refund exceeds the remaining refundable payment amount"
        : "void cannot be matched to the original charge allocations",
    );
  let remaining = requestedMinor;
  const reversalAllocations: PaymentAdjustmentAllocation[] = [];
  for (const candidate of eligible) {
    if (!remaining) break;
    const amountMinor = Math.min(remaining, candidate.remainingMinor);
    remaining -= amountMinor;
    reversalAllocations.push({
      feeOrderId: candidate.feeOrderId,
      chargeId: candidate.chargeId,
      feeHeadId: candidate.feeHeadId,
      label: candidate.label,
      amountMinor,
    });
  }
  if (remaining)
    throw new ConflictError("adjustment could not be fully allocated");
  const now = deps.now?.() ?? new Date();
  const expectedOrderUpdatedAt = new Map<string, Date>();
  const updatedOrders = [...orderMap.values()].map((order) => {
    expectedOrderUpdatedAt.set(order.id, new Date(order.updatedAt));
    const byCharge = new Map(
      reversalAllocations
        .filter((item) => item.feeOrderId === order.id)
        .map((item) => [item.chargeId, item.amountMinor]),
    );
    const charges = order.charges.map((charge) => {
      const amount = byCharge.get(charge.id) ?? 0;
      if (amount > charge.paidMinor)
        throw new ConflictError(
          "adjustment exceeds the charge payment balance",
        );
      return {
        ...charge,
        paidMinor: charge.paidMinor - amount,
        balanceMinor: charge.balanceMinor + amount,
      };
    });
    const paidMinor = charges.reduce(
      (sum, charge) => sum + charge.paidMinor,
      0,
    );
    const balanceMinor = order.totalMinor - paidMinor;
    return {
      ...order,
      charges,
      paidMinor,
      balanceMinor,
      status:
        paidMinor === 0
          ? ("OPEN" as const)
          : balanceMinor === 0
            ? ("PAID" as const)
            : ("PARTIALLY_PAID" as const),
      updatedAt: now,
    };
  });
  const totalReversed = reversedMinor + requestedMinor;
  const updatedPayment = {
    ...payment,
    reversedMinor: totalReversed,
    status:
      value.type === "VOID"
        ? ("VOIDED" as const)
        : totalReversed === payment.amountMinor
          ? ("REFUNDED" as const)
          : ("PARTIALLY_REFUNDED" as const),
    updatedAt: now,
  };
  const adjustment = await adjustmentStore.commit(tenant, {
    expectedPaymentUpdatedAt: new Date(payment.updatedAt),
    expectedOrderUpdatedAt,
    payment: updatedPayment,
    orders: updatedOrders,
    adjustment: {
      tenantId: tenant,
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
      studentId: payment.studentId,
      campusId: payment.campusId,
      academicYearId: payment.academicYearId,
      type: value.type,
      amountMinor: requestedMinor,
      reason: value.reason,
      allocations: reversalAllocations,
      idempotencyKey: value.idempotencyKey,
      createdBy: actorId(context),
      createdAt: now,
    },
  });
  return toPaymentAdjustmentView(adjustment);
}

export async function listPaymentAdjustments(
  filter: unknown,
  context: RequestContext,
  deps: PaymentAdjustmentDependencies = {},
) {
  requirePermission(context, paymentAdjustmentPermissions.read as Permission);
  return (
    await (
      await adjustments(deps)
    ).list(
      tenantId(context),
      validatePaymentAdjustmentFilter(filter) as PaymentAdjustmentFilter,
    )
  ).map(toPaymentAdjustmentView);
}
