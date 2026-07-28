export type GeneralChargeTargetType = "STUDENT" | "CLASS" | "SECTION";
export type GeneralChargeStatus = "ASSIGNING" | "ASSIGNED" | "FAILED";

export interface GeneralChargeTarget {
  type: GeneralChargeTargetType;
  ids: string[];
}

export interface GeneralChargeRecord {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  name: string;
  note?: string;
  feeHeadId: string;
  feeHeadCode: string;
  amountMinor: number;
  collectionPolicy: "FULL_ONLY" | "PARTIAL_ALLOWED";
  target: GeneralChargeTarget;
  status: GeneralChargeStatus;
  assignedCount: number;
  idempotencyKey: string;
  createdBy: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGeneralChargeInput {
  campusId: string;
  academicYearId: string;
  name: string;
  note?: string;
  feeHeadId: string;
  amountMinor: number;
  collectionPolicy: "FULL_ONLY" | "PARTIAL_ALLOWED";
  target: GeneralChargeTarget;
  idempotencyKey: string;
}

export interface GeneralChargeFilter {
  campusId?: string;
  academicYearId?: string;
  status?: GeneralChargeStatus;
}
