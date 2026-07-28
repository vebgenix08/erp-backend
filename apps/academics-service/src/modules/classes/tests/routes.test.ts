import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { InMemoryClassRepository } from "../classes.repository";
import { registerClassRoutes } from "../classes.routes";
import { createClassContext } from "./fixtures";

test("class routes handle create and list requests", async () => {
  const repository = new InMemoryClassRepository();
  const router = createRouter();
  registerClassRoutes(router, { repository, ...academicHierarchyFixture() });

  const context = createClassContext();
  const created = await router.handle({
    requestId: context.requestId,
    method: "POST",
    path: "/classes",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    body: { campusId: "campus_1", programId: "program_1", code: "BSC-1", name: "First Year B.Sc" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(created.statusCode, 201);

  const listed = await router.handle({
    requestId: context.requestId,
    method: "GET",
    path: "/classes",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(listed.statusCode, 200);
  assert.equal(Array.isArray(listed.body), true);
});
