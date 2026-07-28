import type { TemplateServiceContext } from "../../templates.model";

export function createTemplateContext(): TemplateServiceContext {
  return {
    requestId: "req_template",
    tenantContext: {
      tenantId: "tenant_1",
      tenantCode: "alpha",
      source: "request",
      resolvedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    authContext: {
      requestId: "req_template",
      source: "request",
      user: {
        id: "user_1",
        email: "admin@example.test",
        role: "TENANT_ADMIN",
        permissions: [
          "settings.templates.read",
          "settings.templates.create",
          "settings.templates.update",
          "settings.templates.publish",
          "settings.templates.delete",
        ],
        source: "request",
      },
      tenant: {
        tenantId: "tenant_1",
        tenantCode: "alpha",
        source: "request",
        resolvedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}
