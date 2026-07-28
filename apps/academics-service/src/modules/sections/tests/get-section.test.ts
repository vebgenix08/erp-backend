import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySectionRepository } from "../sections.repository";
import { createSectionUseCase, getSectionUseCase } from "../use-cases";
import { createSectionContext } from "./fixtures";

test("get section returns the existing tenant record", async () => {
  const repository = new InMemorySectionRepository();
  const created = await createSectionUseCase(
    { campusId: "campus_1", programId: "program_1", classId: "class_1", code: "A", name: "Section A" },
    createSectionContext(),
    { repository, ...academicHierarchyFixture() },
  );

  const result = await getSectionUseCase(created.id, createSectionContext({ path: `/sections/${created.id}` }), { repository, ...academicHierarchyFixture() });

  assert.equal(result?.id, created.id);
  assert.equal(result?.name, "Section A");
});
