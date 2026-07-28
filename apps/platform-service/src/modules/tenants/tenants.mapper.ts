import type { TenantRecord } from "./tenants.model";

export type TenantView = {
  id: string;
  name: string;
  organizationName: string;
  slug?: string | undefined;
  code: string;
  type: TenantRecord["type"];
  status: TenantRecord["status"];
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  address?: string | undefined;
  academicYearStartMonth?: number | undefined;
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
  deletionRequestedAt?: string | undefined;
  deletionRequestedBy?: string | undefined;
  deletionReason?: string | undefined;
  deletedAt?: string | undefined;
  deletedBy?: string | undefined;
  purgeEligibleAt?: string | undefined;
};

export function toTenantView(tenant: TenantRecord | null): TenantView | null {
  if (!tenant) return null;
  return {
    id: tenant.id,
    name: tenant.name,
    organizationName: tenant.name,
    slug: tenant.slug,
    code: tenant.code,
    type: tenant.type,
    status: tenant.status,
    contactEmail: tenant.contactEmail,
    contactPhone: tenant.contactPhone,
    address: tenant.address,
    academicYearStartMonth: tenant.academicYearStartMonth,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    deactivatedAt: tenant.deactivatedAt?.toISOString(),
    deletionRequestedAt: tenant.deletionRequestedAt?.toISOString(),
    deletionRequestedBy: tenant.deletionRequestedBy,
    deletionReason: tenant.deletionReason,
    deletedAt: tenant.deletedAt?.toISOString(),
    deletedBy: tenant.deletedBy,
    purgeEligibleAt: tenant.purgeEligibleAt?.toISOString(),
  };
}
