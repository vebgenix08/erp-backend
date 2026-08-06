export type AcademicUnitType = "SCHOOL" | "PU" | "DEGREE";
export type AcademicUnitStatus = "ACTIVE" | "INACTIVE";

export interface CampusAcademicUnitRecord {
  id: string;
  tenantId: string;
  campusId: string;
  code: string;
  name: string;
  type: AcademicUnitType;
  curriculumOrAffiliationId: string;
  status: AcademicUnitStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface CampusAcademicUnitCreateInput {
  name: string;
  type: AcademicUnitType;
  curriculumOrAffiliationId: string;
}

export interface CampusAcademicUnitUpdateInput {
  name?: string | undefined;
  curriculumOrAffiliationId?: string | undefined;
  status?: AcademicUnitStatus | undefined;
}

export interface CampusAcademicUnitListFilter {
  campusId?: string | undefined;
  type?: AcademicUnitType | undefined;
  status?: AcademicUnitStatus | undefined;
}

export interface CampusAcademicUnitView extends Omit<CampusAcademicUnitRecord, "createdAt" | "updatedAt" | "deactivatedAt"> {
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}
