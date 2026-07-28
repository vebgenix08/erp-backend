import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySectionRepository } from "../sections.repository";
import { createSectionUseCase, updateSectionUseCase } from "../use-cases";
import { createSectionContext } from "./fixtures";

test("update section changes fields and preserves tenant isolation", async () => {
  const repository = new InMemorySectionRepository();
  const created = await createSectionUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "A", name: "Section A" },
    createSectionContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const updated = await updateSectionUseCase(
    created.id,
    { name: "Section Alpha", status: "INACTIVE" },
    createSectionContext({ method: "PUT", path: `/sections/${created.id}` }),
    { repository, ...academicHierarchyFixture() },
  );

  assert.equal(updated?.name, "Section Alpha");
  assert.equal(updated?.status, "INACTIVE");
  assert.ok(updated?.deactivatedAt);
});
