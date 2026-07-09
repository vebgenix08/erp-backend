import type { AuthContext } from "@school-erp/auth";
import type { Permission } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type EnquiryStatus = "NEW" | "CONTACTED" | "FOLLOW_UP" | "CONVERTED" | "CLOSED";
export type EnquiryGender = "MALE" | "FEMALE" | "OTHER";

export interface EnquiryListFilter {
  status?: EnquiryStatus | undefined;
  source?: string | undefined;
  search?: string | undefined;
}

export interface EnquiryRecord {
  id: string;
  tenantId: string;
  enquiryNumber: string;
  studentName: string;
  dateOfBirth?: Date | undefined;
  gender?: EnquiryGender | undefined;
  parentName: string;
  phone: string;
  email?: string | undefined;
  interestedClass?: string | undefined;
  source?: string | undefined;
  status: EnquiryStatus;
  notes?: string | undefined;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | undefined;
}

export interface EnquiryCreateInput {
  studentName: string;
  dateOfBirth?: Date | undefined;
  gender?: EnquiryGender | undefined;
  parentName: string;
  phone: string;
  email?: string | undefined;
  interestedClass?: string | undefined;
  source?: string | undefined;
  notes?: string | undefined;
}

export interface EnquiryUpdateInput {
  studentName?: string | undefined;
  dateOfBirth?: Date | undefined;
  gender?: EnquiryGender | undefined;
  parentName?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  interestedClass?: string | undefined;
  source?: string | undefined;
  notes?: string | undefined;
  status?: Exclude<EnquiryStatus, "CLOSED"> | undefined;
}

export interface EnquiryCreateStoredInput extends EnquiryCreateInput {
  enquiryNumber: string;
  createdBy: string;
  status: EnquiryStatus;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | undefined;
}

export interface EnquiryUpdateStoredInput extends EnquiryUpdateInput {
  updatedAt: Date;
  closedAt?: Date | undefined;
}

export interface EnquiryView {
  id: string;
  tenantId: string;
  enquiryNumber: string;
  studentName: string;
  dateOfBirth?: string | undefined;
  gender?: EnquiryGender | undefined;
  parentName: string;
  phone: string;
  email?: string | undefined;
  interestedClass?: string | undefined;
  source?: string | undefined;
  status: EnquiryStatus;
  notes?: string | undefined;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | undefined;
}

export interface EnquiryServiceContext {
  tenantContext: TenantContext;
  authContext: AuthContext;
  requestId?: string | undefined;
}
