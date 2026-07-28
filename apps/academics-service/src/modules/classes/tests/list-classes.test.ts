import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryClassRepository } from "../classes.repository";
import { createClassUseCase, listClassesUseCase } from "../use-cases";
import { createClassContext } from "./fixtures";

test("list classes returns tenant-only results", async () => {
  const repository = new InMemoryClassRepository();
  await createClassUseCase({ campusId: "campus_1", programId: "program_1", code: "BSC-1", name: "First Year B.Sc" }, createClassContext(), { repository, ...academicHierarchyFixture() });
  await createClassUseCase({ campusId: "campus_1", programId: "program_1", code: "BSC-2", name: "Second Year B.Sc" }, createClassContext(), { repository, ...academicHierarchyFixture() });

  const result = await listClassesUseCase(createClassContext(), { repository, ...academicHierarchyFixture() }, { campusId: "campus_1" });

  assert.equal(result.length, 2);
});
