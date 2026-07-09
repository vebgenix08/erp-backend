import type { RequestContext } from "@school-erp/api";

export function createSessionContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "req_test_1",
    path: "/session/me",
    method: "GET",
    headers: {},
    query: {},
    body: undefined,
    authContext: {
      user: {
        id: "user_test_1",
        email: "user@example.com",
        role: "ADMIN",
        permissions: ["identity.session.read", "identity.session.select-tenant", "identity.session.logout"],
        source: "headers",
      },
      tenant: {
        tenantId: "tenant_test_1",
        tenantCode: "TENANT-1",
        source: "headers",
      },
      requestId: "req_test_1",
      source: "headers",
      authenticatedAt: new Date(),
    } as any,
    tenantContext: {
      tenantId: "tenant_test_1",
      tenantCode: "TENANT-1",
      source: "headers",
    } as any,
    params: {},
    ...overrides,
  };
}
