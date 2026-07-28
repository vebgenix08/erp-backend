import type { RequestContext } from "@school-erp/api";

export function createProgramContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "req_program_test",
    path: "/programs",
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
          "academics.programs.read",
          "academics.programs.create",
          "academics.programs.update",
          "academics.programs.deactivate",
        ],
        source: "request",
      },
      ...overrides.authContext,
    },
    ...overrides,
  };
}
