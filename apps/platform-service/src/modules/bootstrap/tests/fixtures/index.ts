import type { FirstAdminBootstrapServiceContext } from "../../bootstrap.model";

export function createBootstrapContext(): FirstAdminBootstrapServiceContext {
  return {
    requestId: "req_bootstrap",
    tenantContext: {
      tenantId: "tenant_1",
      tenantCode: "alpha",
      source: "request",
      resolvedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    authContext: {
      requestId: "req_bootstrap",
      source: "request",
      user: {
        id: "user_1",
        email: "platform@example.test",
        role: "SUPER_ADMIN",
        permissions: ["platform.bootstrap.create", "platform.bootstrap.read", "platform.bootstrap.complete"],
        source: "request",
      },
      tenant: {
        tenantId: "platform",
        tenantCode: "platform",
        source: "request",
        resolvedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}
