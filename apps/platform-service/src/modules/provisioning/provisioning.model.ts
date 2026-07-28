export interface ProvisionTenantInput {
  organizationName: string;
  slug: string;
  primaryAdminFullName: string;
  primaryAdminEmail: string;
  clientRequestId: string;
}
export interface ProvisionTenantWarning { code: string; message: string; }
export interface ProvisionTenantResult {
  tenantId: string;
  organizationName: string;
  slug: string;
  onboardingStatus: "ADMIN_ACTIVATION";
  primaryAdminInviteStatus: "PENDING" | "INVITED" | "FAILED" | "COMPLETED";
  warnings: ProvisionTenantWarning[];
}
