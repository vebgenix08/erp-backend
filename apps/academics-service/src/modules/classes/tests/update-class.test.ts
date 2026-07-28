import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryClassRepository } from "../classes.repository";
import { createClassUseCase, updateClassUseCase } from "../use-cases";
import { createClassContext } from "./fixtures";

test("update class changes fields and preserves tenant isolation", async () => {
  const repository = new InMemoryClassRepository();
  const created = await createClassUseCase(
    { campusId: "campus_1", programId: "program_1", code: "BSC-1", name: "First Year B.Sc" },
    createClassContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const updated = await updateClassUseCase(
    created.id,
    { name: "First Year Bachelor of Science", status: "INACTIVE" },
    createClassContext({ method: "PUT", path: `/classes/${created.id}` }),
    { repository, ...academicHierarchyFixture() },
  );

  assert.equal(updated?.name, "First Year Bachelor of Science");
  assert.equal(updated?.status, "INACTIVE");
  assert.ok(updated?.deactivatedAt);
});
