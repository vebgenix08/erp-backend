import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryClassRepository } from "../classes.repository";
import { createClassUseCase, getClassUseCase } from "../use-cases";
import { createClassContext } from "./fixtures";

test("get class returns the existing tenant record", async () => {
  const repository = new InMemoryClassRepository();
  const created = await createClassUseCase(
    { campusId: "campus_1", programId: "program_1", code: "BSC-1", name: "First Year B.Sc" },
    createClassContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const result = await getClassUseCase(created.id, createClassContext({ path: `/classes/${created.id}` }), { repository, ...academicHierarchyFixture() });

  assert.equal(result?.id, created.id);
  assert.equal(result?.name, "First Year B.Sc");
});
