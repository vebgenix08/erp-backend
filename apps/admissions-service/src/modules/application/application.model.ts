import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";
import type {
  AdmissionConfirmedEvent,
  AdmissionConfirmedEventData,
} from "@school-erp/events";

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CONFIRMED"
  | "CANCELLED";
export type ApplicationGender = "MALE" | "FEMALE" | "OTHER";

export interface ApplicationDocumentReference {
  fileId: string;
  documentType: string;
  fileName: string;
}

export interface ApplicationStageEntry {
  status: ApplicationStatus;
  at: Date;
  actorId: string;
  remarks?: string | undefined;
}

export interface ApplicationReview {
  decision: "APPROVED" | "REJECTED";
  reviewedBy: string;
  reviewedAt: Date;
  remarks?: string | undefined;
}

export interface ApplicationRecord {
  id: string;
  tenantId: string;
  applicationNumber?: string | undefined;
  admissionNumber?: string | undefined;
  enquiryId?: string | undefined;
  campusId: string;
  academicYearId: string;
  academicYearCode?: string | undefined;
  academicTargetId: string;
  sectionId?: string | undefined;
  status: ApplicationStatus;
  studentName: string;
  dateOfBirth?: Date | undefined;
  gender?: ApplicationGender | undefined;
  phone: string;
  email?: string | undefined;
  address?: string | undefined;
  parentName: string;
  parentPhone?: string | undefined;
  parentRelation?: string | undefined;
  templateId: string;
  templateVersion: number;
  customFields?: Record<string, unknown> | undefined;
  documents: ApplicationDocumentReference[];
  reviews: ApplicationReview[];
  stageHistory: ApplicationStageEntry[];
  pendingEvents: AdmissionConfirmedEvent[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date | undefined;
  approvedAt?: Date | undefined;
  approvedBy?: string | undefined;
  rejectedAt?: Date | undefined;
  rejectedBy?: string | undefined;
  rejectionReason?: string | undefined;
  confirmedAt?: Date | undefined;
  confirmedBy?: string | undefined;
  cancelledAt?: Date | undefined;
  cancelledBy?: string | undefined;
  cancellationReason?: string | undefined;
}

export interface ApplicationCreateInput {
  enquiryId?: string | undefined;
  campusId: string;
  academicYearId: string;
  academicTargetId: string;
  sectionId?: string | undefined;
  studentName: string;
  dateOfBirth?: Date | undefined;
  gender?: ApplicationGender | undefined;
  phone: string;
  email?: string | undefined;
  address?: string | undefined;
  parentName: string;
  parentPhone?: string | undefined;
  parentRelation?: string | undefined;
  templateId: string;
  templateVersion: number;
  customFields?: Record<string, unknown> | undefined;
  documents: ApplicationDocumentReference[];
}

export type ApplicationUpdateInput = Partial<
  Omit<
    ApplicationCreateInput,
    "campusId" | "academicYearId" | "templateId" | "templateVersion"
  >
>;

export interface ApplicationListFilter {
  status?: ApplicationStatus | undefined;
  campusId?: string | undefined;
  academicYearId?: string | undefined;
  academicTargetId?: string | undefined;
  search?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ApplicationPage {
  items: ApplicationRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ApplicationDuplicateReason =
  | "PHONE"
  | "EMAIL"
  | "NAME_AND_DATE_OF_BIRTH";

export interface ApplicationDuplicateMatch {
  applicationId: string;
  applicationNumber?: string | undefined;
  admissionNumber?: string | undefined;
  studentName: string;
  status: ApplicationStatus;
  reasons: ApplicationDuplicateReason[];
}

export interface ApplicationDuplicateCheck {
  applicationId: string;
  hasPotentialDuplicates: boolean;
  matches: ApplicationDuplicateMatch[];
  checkedAt: string;
}

export interface ApplicationServiceContext {
  tenantContext: TenantContext;
  authContext: AuthContext;
  requestId?: string | undefined;
}

export interface ApplicationView
  extends Omit<
    ApplicationRecord,
    | "dateOfBirth"
    | "createdAt"
    | "updatedAt"
    | "submittedAt"
    | "approvedAt"
    | "rejectedAt"
    | "confirmedAt"
    | "cancelledAt"
    | "reviews"
    | "stageHistory"
    | "pendingEvents"
  > {
  dateOfBirth?: string | undefined;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | undefined;
  approvedAt?: string | undefined;
  rejectedAt?: string | undefined;
  confirmedAt?: string | undefined;
  cancelledAt?: string | undefined;
  reviews: Array<
    Omit<ApplicationReview, "reviewedAt"> & { reviewedAt: string }
  >;
  stageHistory: Array<Omit<ApplicationStageEntry, "at"> & { at: string }>;
}
