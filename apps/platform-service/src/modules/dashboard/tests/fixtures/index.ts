import type { RequestContext } from "@school-erp/api";

export function createPlatformContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: "req_platform_test",
    path: "/dashboard",
    method: "GET",
    headers: {},
    query: {},
    body: undefined,
    params: {},
    authContext: {
      source: "request",
      authenticatedAt: new Date("2025-01-01T00:00:00.000Z"),
      user: {
        id: "platform_admin",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
        permissions: [
          "platform.dashboard.read",
          "platform.feature-flags.read",
          "platform.feature-flags.create",
          "platform.feature-flags.update",
          "platform.audit-logs.read",
          "platform.audit-logs.create",
        ],
        source: "request",
      },
    },
    ...overrides,
  };
}
