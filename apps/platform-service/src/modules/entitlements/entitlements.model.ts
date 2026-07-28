import type { TenantCapabilityCode } from "../capability-catalog/capability-catalog.model";

export type TenantEntitlementStatus = "ENABLED" | "DISABLED";
export interface TenantEntitlementRecord {
  id: string;
  tenantId: string;
  featureCode: TenantCapabilityCode;
  status: TenantEntitlementStatus;
  limits?: Record<string, number> | undefined;
  createdAt: Date;
  updatedAt: Date;
}
export interface TenantEntitlementInput {
  tenantId: string;
  featureCode: TenantCapabilityCode;
  status: TenantEntitlementStatus;
  limits?: Record<string, number> | undefined;
}
