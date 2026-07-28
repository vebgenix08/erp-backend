import { academicHierarchyFixture } from "../../../testing/academic-hierarchy.fixture";
import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySectionRepository } from "../sections.repository";
import { createSectionUseCase, listSectionsUseCase } from "../use-cases";
import { createSectionContext } from "./fixtures";

test("list sections returns tenant-only results", async () => {
  const repository = new InMemorySectionRepository();
  await createSectionUseCase({ campusId: "campus_1", programId: "program_1", classId: "class_1", code: "A", name: "Section A" }, createSectionContext(), { repository, ...academicHierarchyFixture() });
  await createSectionUseCase({ campusId: "campus_1", programId: "program_1", classId: "class_1", code: "B", name: "Section B" }, createSectionContext(), { repository, ...academicHierarchyFixture() });

  const result = await listSectionsUseCase(createSectionContext(), { repository, ...academicHierarchyFixture() }, { campusId: "campus_1" });

  assert.equal(result.length, 2);
});
