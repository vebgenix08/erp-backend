import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { registerDashboardRoutes } from "../dashboard.routes";
import { createPlatformContext } from "./fixtures";

test("dashboard route returns a summary", async () => {
  const router = createRouter();
  registerDashboardRoutes(router, {
    tenants: Promise.resolve({ list: async () => [{ status: "ACTIVE" }] as any } as any),
    featureFlags: Promise.resolve({ list: async () => [{ isEnabled: true }] as any } as any),
    auditLogs: Promise.resolve({ list: async () => [{}, {}] as any } as any),
    bootstraps: Promise.resolve({ list: async () => [{}, {}] as any } as any),
  });

  const result = await router.handle({
    requestId: "req_dashboard",
    method: "GET",
    path: "/dashboard",
    headers: {},
    query: {},
    tenantContext: undefined,
    authContext: createPlatformContext().authContext,
  });

  assert.equal(result.statusCode, 200);
  assert.equal((result.body as any).tenantCount, 1);
});
