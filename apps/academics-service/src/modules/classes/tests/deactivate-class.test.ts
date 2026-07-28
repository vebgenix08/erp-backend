import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryClassRepository } from "../classes.repository";
import { createClassUseCase, deactivateClassUseCase } from "../use-cases";
import { createClassContext } from "./fixtures";

test("deactivate class marks the record inactive", async () => {
  const repository = new InMemoryClassRepository();
  const created = await createClassUseCase(
    { campusId: "campus_1", programId: "program_1", code: "BSC-1", name: "First Year B.Sc" },
    createClassContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const result = await deactivateClassUseCase(created.id, createClassContext({ method: "POST", path: `/classes/${created.id}/deactivate` }), { repository, ...academicHierarchyFixture() });

  assert.equal(result?.status, "INACTIVE");
  assert.ok(result?.deactivatedAt);
});
