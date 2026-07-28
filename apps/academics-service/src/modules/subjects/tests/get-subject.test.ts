import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySubjectRepository } from "../subjects.repository";
import { createSubjectUseCase, getSubjectUseCase } from "../use-cases";
import { createSubjectContext } from "./fixtures";

test("get subject returns the existing tenant record", async () => {
  const repository = new InMemorySubjectRepository();
  const created = await createSubjectUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "ENG", name: "English", subjectType: "THEORY" },
    createSubjectContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const result = await getSubjectUseCase(created.id, createSubjectContext({ path: `/subjects/${created.id}` }), { repository, ...academicHierarchyFixture() });

  assert.equal(result?.id, created.id);
  assert.equal(result?.name, "English");
});
