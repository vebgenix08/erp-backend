export {
  createMockRequestContext,
  createUserFixture,
} from "@school-erp/test-utils";

import type { TenantCreateInput } from "../../tenants.model";

export function createTenantFixture(overrides: Partial<TenantCreateInput> = {}): TenantCreateInput & Record<string, unknown> {
  return {
    clientRequestId: `request_${crypto.randomUUID()}`,
    name: "Sample School",
    code: "SAMPLE-SCHOOL",
    type: "SCHOOL",
    contactEmail: "admin@sample-school.test",
    contactPhone: "+1 555 0100",
    address: "Sample Address",
    academicYearStartMonth: 6,
    ...overrides,
  };
}

import type { RequestContext } from "@school-erp/api";

export function createPlatformAdminContext(): RequestContext {
  return {
    requestId: "req_platform_test",
    path: "/platform/tenants",
    method: "GET",
    headers: {},
    query: {},
    body: undefined,
    params: {},
    authContext: {
      source: "request",
      authenticatedAt: new Date(),
      user: {
        id: "platform_admin_test",
        role: "SUPER_ADMIN",
        permissions: [
          "platform.tenants.read",
          "platform.tenants.create",
          "platform.tenants.update",
          "platform.tenants.delete",
        ],
        source: "request",
      },
    },
  };
}
