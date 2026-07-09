import type { TenantStatus, TenantType } from "@school-erp/types";

export type { TenantStatus, TenantType };

export interface TenantRecord {
  id: string;
  name: string;
  code: string;
  type: TenantType;
  status: TenantStatus;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  academicYearStartMonth?: number | undefined;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface TenantCreateInput {
  name: string;
  code: string;
  type: TenantType;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  academicYearStartMonth?: number | undefined;
}

export interface TenantUpdateInput {
  name?: string;
  code?: string;
  type?: TenantType;
  status?: TenantStatus;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  academicYearStartMonth?: number | undefined;
  deactivatedAt?: Date | undefined;
}
