import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySubjectRepository } from "../subjects.repository";
import { createSubjectUseCase } from "../use-cases";
import { createSubjectContext } from "./fixtures";

test("create subject stores a tenant-scoped active record", async () => {
  const repository = new InMemorySubjectRepository();
  const result = await createSubjectUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "ENG", name: "English", subjectType: "THEORY" },
    createSubjectContext(),
    { repository, ...academicHierarchyFixture() },
  );

  assert.equal(result.code, "SUB-001");
  assert.equal(result.subjectType, "THEORY");
  assert.equal(result.status, "ACTIVE");
});
