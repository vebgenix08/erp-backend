import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { registerAuditLogRoutes } from "../audit-logs.routes";
import { createAuditLogContext } from "./fixtures";

test("audit log route returns filtered logs", async () => {
  const router = createRouter();
  registerAuditLogRoutes(router, {
    repository: Promise.resolve({
      list: async () => [{ id: "1", action: "TENANT_CREATED", entityType: "TENANT", createdAt: new Date() }] as any,
      create: async () => ({ id: "1", action: "TENANT_CREATED", entityType: "TENANT", createdAt: new Date() }) as any,
    } as any),
  });

  const context = createAuditLogContext();
  const result = await router.handle({
    requestId: context.requestId,
    method: "GET",
    path: "/audit-logs",
    headers: context.headers,
    query: context.query,
    tenantContext: undefined,
    authContext: context.authContext,
  });

  assert.equal(result.statusCode, 200);
});
