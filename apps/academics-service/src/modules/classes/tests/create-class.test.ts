import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryClassRepository } from "../classes.repository";
import { createClassUseCase } from "../use-cases";
import { createClassContext } from "./fixtures";

test("create class stores a tenant-scoped active record", async () => {
  const repository = new InMemoryClassRepository();
  const result = await createClassUseCase(
    { campusId: "campus_1", programId: "program_1", code: "CLIENT-CODE-MUST-BE-IGNORED", name: "First Year B.Sc" },
    createClassContext(),
    { repository, ...academicHierarchyFixture() },
  );

  assert.equal(result.code, "CLASS-001");
  assert.equal(result.programId, "program_1");
  assert.equal(result.status, "ACTIVE");
});
