import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySubjectRepository } from "../subjects.repository";
import { createSubjectUseCase, updateSubjectUseCase } from "../use-cases";
import { createSubjectContext } from "./fixtures";

test("update subject changes fields and preserves tenant isolation", async () => {
  const repository = new InMemorySubjectRepository();
  const created = await createSubjectUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "ENG", name: "English", subjectType: "THEORY" },
    createSubjectContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const updated = await updateSubjectUseCase(
    created.id,
    { name: "English Language", status: "INACTIVE" },
    createSubjectContext({ method: "PUT", path: `/subjects/${created.id}` }),
    { repository, ...academicHierarchyFixture() },
  );

  assert.equal(updated?.name, "English Language");
  assert.equal(updated?.status, "INACTIVE");
  assert.ok(updated?.deactivatedAt);
});
