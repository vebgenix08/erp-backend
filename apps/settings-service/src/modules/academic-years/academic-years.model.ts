export type AcademicYearStatus = "DRAFT" | "ACTIVE" | "CLOSED";

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
  closedAt?: Date | undefined;
  reopenedAt?: Date | undefined;
  lifecycleReason?: string | undefined;
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
