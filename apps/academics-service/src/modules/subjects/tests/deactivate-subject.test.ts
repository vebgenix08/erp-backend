import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySubjectRepository } from "../subjects.repository";
import { createSubjectUseCase, deactivateSubjectUseCase } from "../use-cases";
import { createSubjectContext } from "./fixtures";

test("deactivate subject marks the record inactive", async () => {
  const repository = new InMemorySubjectRepository();
  const created = await createSubjectUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "ENG", name: "English", subjectType: "THEORY" },
    createSubjectContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const result = await deactivateSubjectUseCase(created.id, createSubjectContext({ method: "POST", path: `/subjects/${created.id}/deactivate` }), { repository, ...academicHierarchyFixture() });

  assert.equal(result?.status, "INACTIVE");
  assert.ok(result?.deactivatedAt);
});
