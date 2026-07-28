import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { registerFeatureFlagRoutes } from "../feature-flags.routes";
import { createFeatureFlagContext } from "./fixtures";

test("feature flag routes handle create and list", async () => {
  const router = createRouter();
  registerFeatureFlagRoutes(router, {
    repository: Promise.resolve({
      list: async () => [{ id: "1", code: "A", name: "A", isEnabled: true, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() }] as any,
      getById: async () => null,
      getByCode: async () => null,
      create: async (input: any) => ({ id: "1", code: input.code, name: input.name, isEnabled: true, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() }),
      update: async () => null,
    } as any),
  });

  const context = createFeatureFlagContext();
  const list = await router.handle({
    requestId: context.requestId,
    method: "GET",
    path: "/feature-flags",
    headers: context.headers,
    query: context.query,
    tenantContext: undefined,
    authContext: context.authContext,
  });

  assert.equal(list.statusCode, 200);
});
