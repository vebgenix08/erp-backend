import { resolveAuthFromRequest } from "@school-erp/auth";
import { resolveTenantFromRequest } from "@school-erp/tenancy";

export function createEnquiryServiceContext(overrides: {
  tenantId?: string;
  userId?: string;
  permissions?: string[] | string;
  requestId?: string;
} = {}) {
  const request = {
    requestId: overrides.requestId ?? "req_test_1",
    headers: {
      "x-user-id": overrides.userId ?? "user_test_1",
      "x-user-permissions": overrides.permissions ?? "admissions.enquiry.read admissions.enquiry.create admissions.enquiry.update admissions.enquiry.close",
      "x-tenant-id": overrides.tenantId ?? "tenant_test_1",
    },
  };

  return {
    tenantContext: resolveTenantFromRequest(request),
    authContext: resolveAuthFromRequest(request),
    requestId: request.requestId,
  };
}

export function createEnquiryInput(overrides: Record<string, unknown> = {}) {
  return {
    studentName: "Alice Example",
    parentName: "Parent Example",
    phone: "+1 555 0100",
    source: "Walk-in",
    ...overrides,
  };
}
