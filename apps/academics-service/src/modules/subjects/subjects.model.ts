import type { RequestContext } from "@school-erp/api";

export type SubjectStatus = "ACTIVE" | "INACTIVE";
export type SubjectType = "THEORY" | "PRACTICAL" | "MIXED";

export interface SubjectRecord {
  id: string;
  tenantId: string;
  campusId: string;
  programId: string;
  classId?: string | undefined;
  code: string;
  name: string;
  subjectType: SubjectType;
  credits?: number | undefined;
  status: SubjectStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface SubjectCreateInput {
  campusId: string;
  programId: string;
  classId?: string | undefined;
  name: string;
  subjectType: SubjectType;
  credits?: number | undefined;
}

export interface SubjectUpdateInput {
  programId?: string | undefined;
  classId?: string | undefined;
  name?: string | undefined;
  subjectType?: SubjectType | undefined;
  credits?: number | undefined;
  status?: SubjectStatus | undefined;
}

export interface SubjectListFilter {
  campusId: string;
  programId?: string | undefined;
  classId?: string | undefined;
  status?: SubjectStatus | undefined;
}

export interface SubjectView {
  id: string;
  tenantId: string;
  campusId: string;
  programId: string;
  classId?: string | undefined;
  code: string;
  name: string;
  subjectType: SubjectType;
  credits?: number | undefined;
  status: SubjectStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}

export interface SubjectServiceContext {
  requestId: string;
  tenantContext: RequestContext["tenantContext"];
  authContext: RequestContext["authContext"];
}
