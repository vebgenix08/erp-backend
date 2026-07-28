import type { RequestContext } from "@school-erp/api";

export function createSectionContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "req_section_test",
    path: "/sections",
    method: "GET",
    headers: {},
    query: {},
    body: undefined,
    params: {},
    tenantContext: {
      tenantId: "tenant_1",
      source: "request",
      resolvedAt: new Date("2025-01-01T00:00:00.000Z"),
    },
    authContext: {
      source: "request",
      authenticatedAt: new Date("2025-01-01T00:00:00.000Z"),
      tenant: {
        tenantId: "tenant_1",
        source: "request",
        resolvedAt: new Date("2025-01-01T00:00:00.000Z"),
      },
      user: {
        id: "user_1",
        email: "admin@example.com",
        role: "TENANT_ADMIN",
        permissions: [
          "academics.sections.read",
          "academics.sections.create",
          "academics.sections.update",
          "academics.sections.deactivate",
        ],
        source: "request",
      },
    },
    ...overrides,
  };
}
