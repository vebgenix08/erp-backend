import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthFromRequestAsync } from "../index";

test("resolves auth from bearer token using cognito verifier", async () => {
  const context = await resolveAuthFromRequestAsync(
    {
      headers: {
        authorization: "Bearer fake-token",
        "x-tenant-id": "tenant-live",
      },
    },
    {
      cognito: {
        region: "ap-south-1",
        userPoolId: "pool_123",
        clientId: "client_123",
      },
      verifyJwt: async () => ({
        verified: true,
        claims: {
          sub: "user-live",
          email: "live@example.test",
          role: "ADMIN",
          permissions: ["platform.tenant.create"],
          tenantId: "tenant-live",
        },
      }),
    },
  );

  assert.equal(context.source, "jwt-claims");
  assert.equal(context.user?.id, "user-live");
  assert.equal(context.tenant?.tenantId, "tenant-live");
});
