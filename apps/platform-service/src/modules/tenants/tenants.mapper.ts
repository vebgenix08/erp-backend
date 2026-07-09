import type { TenantRecord } from "./tenants.model";

export type TenantView = {
  id: string;
  name: string;
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
};

export function toTenantView(tenant: TenantRecord | null): TenantView | null {
  if (!tenant) return null;
  return {
    ...tenant,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    deactivatedAt: tenant.deactivatedAt?.toISOString(),
  };
}
