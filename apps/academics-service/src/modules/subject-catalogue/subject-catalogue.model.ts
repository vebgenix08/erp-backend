export type SubjectCatalogueStatus = "ACTIVE" | "INACTIVE";

export interface SubjectCatalogueRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  departmentId?: string;
  subjectDomain?: string;
  status: SubjectCatalogueStatus;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export interface SubjectCatalogueCreateInput {
  name: string;
  shortName?: string;
  description?: string;
  departmentId?: string;
  subjectDomain?: string;
}

export interface SubjectCatalogueUpdateInput {
  name?: string;
  shortName?: string;
  description?: string;
  departmentId?: string;
  subjectDomain?: string;
  expectedVersion: number;
}

export interface SubjectCatalogueFilter {
  search?: string;
  status?: SubjectCatalogueStatus;
  departmentId?: string;
  subjectDomain?: string;
}
