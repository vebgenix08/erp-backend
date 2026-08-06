export type CurriculumType =
  | "STATE_BOARD"
  | "CBSE"
  | "ICSE"
  | "PU_BOARD"
  | "UNIVERSITY"
  | "AUTONOMOUS"
  | "OTHER";

export type CurriculumStatus = "ACTIVE" | "INACTIVE";

export interface CurriculumRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: CurriculumType;
  authorityName?: string | undefined;
  status: CurriculumStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface CurriculumCreateInput {
  name: string;
  type: CurriculumType;
  authorityName?: string | undefined;
}

export interface CurriculumUpdateInput {
  name?: string | undefined;
  type?: CurriculumType | undefined;
  authorityName?: string | undefined;
  status?: CurriculumStatus | undefined;
}

export interface CurriculumListFilter {
  status?: CurriculumStatus | undefined;
  type?: CurriculumType | undefined;
}

export interface CurriculumView extends Omit<CurriculumRecord, "createdAt" | "updatedAt" | "deactivatedAt"> {
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}
