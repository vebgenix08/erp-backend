import type { TenantType } from "@school-erp/types";

export type CampusType = TenantType;
export type CampusStatus = "ACTIVE" | "INACTIVE";

export interface CampusRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  campusType: CampusType;
  status: CampusStatus;
  address?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface CampusCreateInput {
  code: string;
  name: string;
  campusType: CampusType;
  address?: string | undefined;
}

export interface CampusUpdateInput {
  code?: string;
  name?: string;
  campusType?: CampusType;
  status?: CampusStatus;
  address?: string | undefined;
}

export interface CampusListFilter {
  status?: CampusStatus | undefined;
}

export interface CampusView extends CampusRecord {}
