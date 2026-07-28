import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "@school-erp/api";
import { InMemorySubjectRepository } from "../subjects.repository";
import { registerSubjectRoutes } from "../subjects.routes";
import { createSubjectContext } from "./fixtures";

test("subject routes handle create and list requests", async () => {
  const repository = new InMemorySubjectRepository();
  const router = createRouter();
  registerSubjectRoutes(router, { repository, ...academicHierarchyFixture() });

  const context = createSubjectContext();
  const created = await router.handle({
    requestId: context.requestId,
    method: "POST",
    path: "/subjects",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    body: { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "ENG", name: "English", subjectType: "THEORY" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(created.statusCode, 201);

  const listed = await router.handle({
    requestId: context.requestId,
    method: "GET",
    path: "/subjects",
    headers: context.headers,
    query: { ...context.query, campusId: "campus_1" },
    tenantContext: context.tenantContext,
    authContext: context.authContext,
  });

  assert.equal(listed.statusCode, 200);
  assert.equal(Array.isArray(listed.body), true);
});
