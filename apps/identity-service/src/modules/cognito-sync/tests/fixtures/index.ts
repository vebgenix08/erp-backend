import type { CognitoSyncServiceContext } from "../../cognito-sync.model";

export function createCognitoSyncContext(): CognitoSyncServiceContext {
  return {
    requestId: "req_cognito_sync",
      tenantContext: {
        tenantId: "tenant_1",
        tenantCode: "alpha",
        source: "request",
        resolvedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      authContext: {
        requestId: "req_cognito_sync",
        source: "request",
        user: {
          id: "user_1",
          email: "admin@example.test",
        role: "TENANT_ADMIN",
        permissions: ["identity.cognito-sync.create", "identity.cognito-sync.read", "identity.cognito-sync.update", "identity.cognito-sync.delete"],
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
