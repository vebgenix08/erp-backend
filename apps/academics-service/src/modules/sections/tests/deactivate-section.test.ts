import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySectionRepository } from "../sections.repository";
import { createSectionUseCase, deactivateSectionUseCase } from "../use-cases";
import { createSectionContext } from "./fixtures";

test("deactivate section marks the record inactive", async () => {
  const repository = new InMemorySectionRepository();
  const created = await createSectionUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "A", name: "Section A" },
    createSectionContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const result = await deactivateSectionUseCase(created.id, createSectionContext({ method: "POST", path: `/sections/${created.id}/deactivate` }), { repository, ...academicHierarchyFixture() });

  assert.equal(result?.status, "INACTIVE");
  assert.ok(result?.deactivatedAt);
});
