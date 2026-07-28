export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "UPI"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "ONLINE";
export type PaymentStatus =
  | "SUCCESS"
  | "PARTIALLY_REFUNDED"
  | "VOIDED"
  | "REFUNDED";
export interface PaymentChargeAllocation {
  chargeId: string;
  feeHeadId: string;
  label: string;
  amountMinor: number;
}
export interface PaymentAllocation {
  feeOrderId: string;
  label: string;
  amountMinor: number;
  chargeAllocations: PaymentChargeAllocation[];
}
export interface PaymentRecord {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  studentId: string;
  studentName: string;
  receiptNumber: string;
  amountMinor: number;
  reversedMinor: number;
  currency: "INR";
  method: PaymentMethod;
  reference?: string;
  note?: string;
  allocations: PaymentAllocation[];
  status: PaymentStatus;
  idempotencyKey: string;
  collectedBy: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface PaymentAllocationInput {
  feeOrderId: string;
  amountMinor: number;
  chargeAllocations?: PaymentChargeAllocationInput[];
}
export interface PaymentChargeAllocationInput {
  chargeId: string;
  amountMinor: number;
}
export interface CollectPaymentInput {
  studentId: string;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  allocations: PaymentAllocationInput[];
  idempotencyKey: string;
  paidAt?: string;
}
export interface PaymentFilter {
  campusId?: string;
  academicYearId?: string;
  studentId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  paidFrom?: string;
  paidTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
export interface PaymentPage {
  items: PaymentRecord[];
  total: number;
  limit: number;
  offset: number;
}
export interface ReceiptView {
  receiptNumber: string;
  paymentId: string;
  status: PaymentStatus;
  student: { id: string; name: string };
  campusId: string;
  academicYearId: string;
  currency: "INR";
  amountMinor: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  allocations: PaymentAllocation[];
  paidAt: string;
  issuedAt: string;
  collectedBy: string;
  fileName: string;
  documentHtml: string;
  paperSize: "A4" | "A5" | "THERMAL_80MM";
}
export interface ReceiptDocument {
  bytes: Uint8Array;
  contentType: "application/pdf";
  fileName: string;
}
