import type { PaymentChargeAllocation } from "../payments/payments.model";

export type PaymentAdjustmentType = "VOID" | "REFUND";
export interface PaymentAdjustmentAllocation extends PaymentChargeAllocation {
  feeOrderId: string;
}
export interface PaymentAdjustmentRecord {
  id: string;
  tenantId: string;
  adjustmentNumber: string;
  paymentId: string;
  receiptNumber: string;
  studentId: string;
  campusId: string;
  academicYearId: string;
  type: PaymentAdjustmentType;
  amountMinor: number;
  reason: string;
  allocations: PaymentAdjustmentAllocation[];
  idempotencyKey: string;
  createdBy: string;
  createdAt: Date;
}
export interface CreatePaymentAdjustmentInput {
  paymentId: string;
  type: PaymentAdjustmentType;
  amountMinor?: number;
  reason: string;
  idempotencyKey: string;
}
export interface PaymentAdjustmentFilter {
  paymentId?: string;
  campusId?: string;
  academicYearId?: string;
  type?: PaymentAdjustmentType;
}
