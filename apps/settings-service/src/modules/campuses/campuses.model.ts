export type CampusStatus = "ACTIVE" | "INACTIVE";

export interface CampusRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: CampusStatus;
  address?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface CampusCreateInput {
  name: string;
  address?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
}

export interface CampusUpdateInput {
  name?: string;
  status?: CampusStatus;
  address?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
}

export interface CampusListFilter {
  status?: CampusStatus | undefined;
  search?: string | undefined;
}

export interface CampusView extends CampusRecord {}
