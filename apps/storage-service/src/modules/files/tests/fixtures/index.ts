import type { FileServiceContext } from "../../files.model";

export function createStorageContext(): FileServiceContext {
  return {
    requestId: "req_storage",
    tenantContext: {
      tenantId: "tenant_1",
      tenantCode: "alpha",
      source: "request",
      resolvedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    authContext: {
      requestId: "req_storage",
      source: "request",
      user: {
        id: "user_1",
        email: "admin@example.test",
        role: "TENANT_ADMIN",
        permissions: ["storage.files.create", "storage.files.read", "storage.files.update", "storage.files.delete"],
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
