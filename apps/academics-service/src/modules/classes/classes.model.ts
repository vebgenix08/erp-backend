import type { RequestContext } from "@school-erp/api";

export type ClassStatus = "ACTIVE" | "INACTIVE";

export interface ClassRecord {
  id: string;
  tenantId: string;
  campusId: string;
  programId: string;
  code: string;
  name: string;
  description?: string | undefined;
  status: ClassStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface ClassCreateInput {
  campusId: string;
  programId: string;
  name: string;
  description?: string | undefined;
}

export interface ClassUpdateInput {
  programId?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  status?: ClassStatus | undefined;
}

export interface ClassListFilter {
  campusId: string;
  programId?: string | undefined;
  status?: ClassStatus | undefined;
}

export interface ClassView {
  id: string;
  tenantId: string;
  campusId: string;
  programId: string;
  code: string;
  name: string;
  description?: string | undefined;
  status: ClassStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}

export interface ClassServiceContext {
  requestId: string;
  tenantContext: RequestContext["tenantContext"];
  authContext: RequestContext["authContext"];
}
