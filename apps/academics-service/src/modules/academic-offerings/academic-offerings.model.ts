export type AcademicOfferingStatus = "ACTIVE" | "INACTIVE";

export interface AcademicOfferingRecord {
  id: string;
  tenantId: string;
  campusId: string;
  academicYearId: string;
  curriculumId: string;
  programId: string;
  classId: string;
  sectionId?: string | undefined;
  medium?: string | undefined;
  capacity?: number | undefined;
  status: AcademicOfferingStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface AcademicOfferingCreateInput {
  campusId: string;
  academicYearId: string;
  curriculumId: string;
  programId: string;
  classId: string;
  sectionId?: string | undefined;
  medium?: string | undefined;
  capacity?: number | undefined;
}

export interface AcademicOfferingUpdateInput {
  sectionId?: string | undefined;
  medium?: string | undefined;
  capacity?: number | undefined;
  status?: AcademicOfferingStatus | undefined;
}

export interface AcademicOfferingListFilter {
  campusId?: string | undefined;
  academicYearId?: string | undefined;
  curriculumId?: string | undefined;
  programId?: string | undefined;
  classId?: string | undefined;
  status?: AcademicOfferingStatus | undefined;
}

export interface AcademicOfferingView extends Omit<AcademicOfferingRecord, "createdAt" | "updatedAt" | "deactivatedAt"> {
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}
