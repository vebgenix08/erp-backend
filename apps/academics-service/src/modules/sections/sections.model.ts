import type { RequestContext } from "@school-erp/api";

export type SectionStatus = "ACTIVE" | "INACTIVE";

export interface SectionRecord {
  id: string;
  tenantId: string;
  campusId: string;
  programId: string;
  classId: string;
  code: string;
  name: string;
  description?: string | undefined;
  status: SectionStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface SectionCreateInput {
  campusId: string;
  programId: string;
  classId: string;
  name: string;
  description?: string | undefined;
}

export interface SectionUpdateInput {
  programId?: string | undefined;
  classId?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  status?: SectionStatus | undefined;
}

export interface SectionListFilter {
  campusId: string;
  programId?: string | undefined;
  classId?: string | undefined;
  status?: SectionStatus | undefined;
}

export interface SectionView {
  id: string;
  tenantId: string;
  campusId: string;
  programId: string;
  classId: string;
  code: string;
  name: string;
  description?: string | undefined;
  status: SectionStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}

export interface SectionServiceContext {
  requestId: string;
  tenantContext: RequestContext["tenantContext"];
  authContext: RequestContext["authContext"];
}
