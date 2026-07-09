export interface InstitutionProfileRecord {
  id: string;
  tenantId: string;
  name: string;
  shortName?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  logoUrl?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionProfileInput {
  name: string;
  shortName?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  logoUrl?: string | undefined;
}

export type InstitutionProfileUpdateInput = Partial<InstitutionProfileInput>;

export interface InstitutionProfileView extends InstitutionProfileRecord {}
