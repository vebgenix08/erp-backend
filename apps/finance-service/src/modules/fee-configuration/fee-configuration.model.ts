export type FinanceRecordStatus = "ACTIVE" | "INACTIVE";
export type FeeHeadCategory =
  | "TUITION"
  | "ADMISSION"
  | "EXAM"
  | "LIBRARY"
  | "LAB"
  | "TRANSPORT"
  | "HOSTEL"
  | "OTHER";
export type FeeSchedulePattern = "ANNUAL" | "ONE_TIME" | "PERIODIC" | "MANUAL";
export type FeeCollectionPolicy = "FULL_ONLY" | "PARTIAL_ALLOWED";

interface AuditFields {
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeHeadRecord extends AuditFields {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: FeeHeadCategory;
  description?: string;
  refundable: boolean;
  status: FinanceRecordStatus;
}

export interface FeeScheduleRecord extends AuditFields {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  code: string;
  name: string;
  pattern: FeeSchedulePattern;
  collectionPolicy: FeeCollectionPolicy;
  status: FinanceRecordStatus;
}

export interface FeeStructureComponent {
  feeHeadId: string;
  amountMinor: number;
  allocationPriority?: number;
}

export interface FeeStructureRecord extends AuditFields {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  code: string;
  name: string;
  currency: "INR";
  components: FeeStructureComponent[];
  totalAmountMinor: number;
  status: FinanceRecordStatus;
}

export interface FeeMappingTarget {
  programId?: string;
  classId: string;
  sectionId?: string;
}

export interface FeeMappingRecord extends AuditFields {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  structureId: string;
  scheduleId: string;
  target: FeeMappingTarget;
  status: FinanceRecordStatus;
}

export interface FeeConfigurationSnapshot {
  feeHeads: FeeHeadRecord[];
  schedules: FeeScheduleRecord[];
  structures: FeeStructureRecord[];
  mappings: FeeMappingRecord[];
}

export interface FeeConfigurationScope {
  campusId: string;
  academicYearId: string;
}
export interface CreateFeeHeadInput {
  name: string;
  category: FeeHeadCategory;
  description?: string;
  refundable?: boolean;
}
export type UpdateFeeHeadInput = CreateFeeHeadInput;
export interface CreateFeeScheduleInput extends FeeConfigurationScope {
  name: string;
  pattern: FeeSchedulePattern;
  collectionPolicy: FeeCollectionPolicy;
}
export interface CreateFeeStructureInput extends FeeConfigurationScope {
  name: string;
  components: FeeStructureComponent[];
}
export interface CreateFeeMappingInput extends FeeConfigurationScope {
  structureId: string;
  scheduleId: string;
  target: FeeMappingTarget;
}
