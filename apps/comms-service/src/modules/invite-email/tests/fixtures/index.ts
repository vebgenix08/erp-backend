import { createMockRequestContext } from "@school-erp/test-utils";
import { createTenantContext } from "@school-erp/tenancy";
import type { AuthContext } from "@school-erp/auth";
import type { RequestContext } from "@school-erp/api";

function createAuthContext(): AuthContext {
  return {
    user: {
      id: "user_test_1",
      email: "admin@example.test",
      role: "TENANT_ADMIN",
      permissions: ["comms.invites.send", "comms.invites.read"],
      source: "headers",
    },
    tenant: createTenantContext({
      tenantId: "tenant_test_1",
      tenantCode: "tenant-test",
      source: "request",
    }),
    requestId: "req_test_1",
    source: "headers",
    authenticatedAt: new Date("2026-07-09T00:00:00.000Z"),
  };
}

export function createInviteEmailContext(overrides: Partial<RequestContext> = {}): RequestContext {
  const request = createMockRequestContext();
  return {
    requestId: request.requestId,
    tenantContext: createTenantContext({
      tenantId: request.tenantId,
      tenantCode: "tenant-test",
      source: "request",
    }),
    authContext: createAuthContext(),
    path: "/invite-emails",
    method: "POST",
    headers: {},
    query: {},
    body: {},
    params: {},
    ...overrides,
  };
}
