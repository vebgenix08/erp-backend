import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySubjectRepository } from "../subjects.repository";
import { createSubjectUseCase, listSubjectsUseCase } from "../use-cases";
import { createSubjectContext } from "./fixtures";

test("list subjects returns tenant-only results", async () => {
  const repository = new InMemorySubjectRepository();
  await createSubjectUseCase({ campusId: "campus_1", programId: "program_1", classId: "class_1", code: "ENG", name: "English", subjectType: "THEORY" }, createSubjectContext(), { repository, ...academicHierarchyFixture() });
  await createSubjectUseCase({ campusId: "campus_1", programId: "program_1", classId: "class_1", code: "MATH", name: "Mathematics", subjectType: "THEORY" }, createSubjectContext(), { repository, ...academicHierarchyFixture() });

  const result = await listSubjectsUseCase(createSubjectContext(), { repository, ...academicHierarchyFixture() }, { campusId: "campus_1" });

  assert.equal(result.length, 2);
});
