import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { InMemorySectionRepository } from "../sections.repository";
import { registerSectionRoutes } from "../sections.routes";
import { createSectionContext } from "./fixtures";

test("section routes handle create and list requests", async () => {
  const repository = new InMemorySectionRepository();
  const router = createRouter();
  registerSectionRoutes(router, { repository, ...academicHierarchyFixture() });

  const context = createSectionContext();
  const created = await router.handle({
    requestId: context.requestId,
    method: "POST",
    path: "/sections",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    body: { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "A", name: "Section A" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(created.statusCode, 201);

  const listed = await router.handle({
    requestId: context.requestId,
    method: "GET",
    path: "/sections",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(listed.statusCode, 200);
  assert.equal(Array.isArray(listed.body), true);
});
