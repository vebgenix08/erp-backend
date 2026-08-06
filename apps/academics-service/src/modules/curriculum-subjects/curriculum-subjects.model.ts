export type CurriculumSubjectCategory = "CORE" | "LANGUAGE" | "ELECTIVE" | "OPTIONAL" | "ACTIVITY";
export type CurriculumSubjectStatus = "ACTIVE" | "INACTIVE";

export interface CurriculumSubjectRecord {
  id: string;
  tenantId: string;
  academicUnitId: string;
  curriculumId: string;
  programId: string;
  academicLevelId: string;
  subjectCatalogueId: string;
  localSubjectCode?: string;
  subjectCategory: CurriculumSubjectCategory;
  gradingSchemeId?: string;
  examinationSchemeId?: string;
  credits?: number;
  isMandatory: boolean;
  status: CurriculumSubjectStatus;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  deactivationReason?: string;
}

export type CurriculumSubjectCreateInput = Pick<CurriculumSubjectRecord,
  "academicUnitId" | "curriculumId" | "programId" | "academicLevelId" | "subjectCatalogueId" |
  "subjectCategory" | "isMandatory"> & Partial<Pick<CurriculumSubjectRecord,
  "localSubjectCode" | "gradingSchemeId" | "examinationSchemeId" | "credits">>;
export type CurriculumSubjectUpdateInput = Partial<Pick<CurriculumSubjectRecord,
  "localSubjectCode" | "subjectCategory" | "gradingSchemeId" | "examinationSchemeId" | "credits" | "isMandatory">> & { expectedVersion: number };
export type CurriculumSubjectFilter = Partial<Pick<CurriculumSubjectRecord,
  "academicUnitId" | "curriculumId" | "programId" | "academicLevelId" | "subjectCatalogueId" | "subjectCategory" | "status">>;
