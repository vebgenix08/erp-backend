import type { PaymentAdjustmentRecord } from "./payment-adjustments.model";
export const toPaymentAdjustmentView = (record: PaymentAdjustmentRecord) => ({
  ...record,
  allocations: record.allocations.map((item) => ({ ...item })),
  createdAt: record.createdAt.toISOString(),
});
