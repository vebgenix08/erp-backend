import type { RequestContext } from "@school-erp/api";

export type ProgramStatus = "ACTIVE" | "INACTIVE";

export interface ProgramRecord {
  id: string;
  tenantId: string;
  campusId: string;
  code: string;
  name: string;
  description?: string | undefined;
  status: ProgramStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface ProgramCreateInput {
  campusId: string;
  name: string;
  description?: string | undefined;
}

export interface ProgramUpdateInput {
  name?: string | undefined;
  description?: string | undefined;
  status?: ProgramStatus | undefined;
}

export interface ProgramListFilter {
  campusId: string;
  status?: ProgramStatus | undefined;
}

export interface ProgramView {
  id: string;
  tenantId: string;
  campusId: string;
  code: string;
  name: string;
  description?: string | undefined;
  status: ProgramStatus;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}

export interface ProgramServiceContext {
  requestId: string;
  tenantContext: RequestContext["tenantContext"];
  authContext: RequestContext["authContext"];
}
