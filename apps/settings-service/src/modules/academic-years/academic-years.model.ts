export type AcademicYearStatus = "ACTIVE" | "INACTIVE";

export interface AcademicYearRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date | undefined;
  deactivatedAt?: Date | undefined;
}

export interface AcademicYearCreateInput {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AcademicYearUpdateInput {
  code?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface AcademicYearListFilter {
  status?: AcademicYearStatus | undefined;
}

export interface AcademicYearView extends AcademicYearRecord {}
