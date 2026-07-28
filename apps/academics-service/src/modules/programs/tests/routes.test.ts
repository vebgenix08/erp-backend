import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { InMemoryProgramRepository } from "../programs.repository";
import { registerProgramRoutes } from "../programs.routes";
import { createProgramContext } from "./fixtures";

test("program routes handle create and list requests", async () => {
  const repository = new InMemoryProgramRepository();
  const router = createRouter();
  registerProgramRoutes(router, { repository });

  const context = createProgramContext();
  const created = await router.handle({
    requestId: context.requestId,
    method: "POST",
    path: "/programs",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    body: { campusId: "campus_1", code: "BCOM", name: "Bachelor of Commerce" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(created.statusCode, 201);

  const listed = await router.handle({
    requestId: context.requestId,
    method: "GET",
    path: "/programs",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(listed.statusCode, 200);
  assert.equal(Array.isArray(listed.body), true);
  assert.equal((listed.body as Array<{ campusId: "campus_1", code: string }>).length, 1);
});
