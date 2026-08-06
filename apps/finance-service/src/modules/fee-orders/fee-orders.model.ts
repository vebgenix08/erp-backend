export type FeeOrderStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CLOSED" | "CANCELLED";
export type FeeOrderSourceType = "ANNUAL" | "GENERAL" | "TRANSFER_ADJUSTMENT";

export interface FeeOrderCharge {
  id: string;
  feeHeadId: string;
  feeHeadCode: string;
  label: string;
  refundable: boolean;
  sequence: number;
  amountMinor: number;
  paidMinor: number;
  balanceMinor: number;
  creditMinor?: number;
}

export interface FeeOrderRecord {
  id: string;
  tenantId: string;
  orderNumber: string;
  sourceType: FeeOrderSourceType;
  sourceId: string;
  note?: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  enrollmentId: string;
  admissionApplicationId: string;
  campusId: string;
  academicYearId: string;
  programId: string;
  classId: string;
  sectionId?: string;
  mappingId: string;
  structureId: string;
  structureCode: string;
  structureName: string;
  scheduleId: string;
  scheduleCode: string;
  scheduleName: string;
  collectionPolicy: "FULL_ONLY" | "PARTIAL_ALLOWED";
  currency: "INR";
  charges: FeeOrderCharge[];
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  transferId?: string;
  transferCreditMinor?: number;
  residualTransferCreditMinor?: number;
  closedBalanceMinor?: number;
  closureReason?: "CAMPUS_TRANSFER";
  closedAt?: Date;
  status: FeeOrderStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeOrderFilter {
  campusId?: string;
  academicYearId?: string;
  studentId?: string;
  classId?: string;
  sectionId?: string;
  status?: FeeOrderStatus;
  sourceType?: FeeOrderSourceType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FeeOrderPage {
  items: FeeOrderRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface GenerateFeeOrderInput {
  transferId?: string;
  admissionApplicationId: string;
  studentId: string;
  studentName: string;
  registrationNumber: string;
  enrollmentId: string;
  campusId: string;
  academicYearId: string;
  programId: string;
  classId: string;
  sectionId?: string;
  createdBy: string;
}
