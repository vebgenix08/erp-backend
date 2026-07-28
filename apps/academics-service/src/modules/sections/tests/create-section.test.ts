import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySectionRepository } from "../sections.repository";
import { createSectionUseCase } from "../use-cases";
import { createSectionContext } from "./fixtures";

test("create section stores a tenant-scoped active record", async () => {
  const repository = new InMemorySectionRepository();
  const result = await createSectionUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "A", name: "Section A" },
    createSectionContext(),
    { repository, ...academicHierarchyFixture() },
  );

  assert.equal(result.code, "SEC-001");
  assert.equal(result.classId, "class_1");
  assert.equal(result.status, "ACTIVE");
});
