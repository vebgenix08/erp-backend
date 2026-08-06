import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestError } from "@school-erp/errors";
import { InMemoryProgramRepository } from "../../programs/programs.repository";
import { InMemoryClassRepository } from "../../classes/classes.repository";
import { InMemorySectionRepository } from "../sections.repository";
import { createSectionUseCase } from "../use-cases";
import { createSectionContext } from "./fixtures";

test("section rejects a class from a different program", async () => {
  const repository = new InMemorySectionRepository();
  const programRepository = new InMemoryProgramRepository();
  const classRepository = new InMemoryClassRepository();
  const selectedProgram = await programRepository.create("tenant_1", { campusId: "campus_1", academicUnitId: "unit_school", code: "PROG-001", name: "Primary" });
  const otherProgram = await programRepository.create("tenant_1", { campusId: "campus_1", academicUnitId: "unit_school", code: "PROG-002", name: "Secondary" });
  const academicClass = await classRepository.create("tenant_1", { campusId: "campus_1", programId: otherProgram.id, code: "CLASS-001", name: "Grade 6" });

  await assert.rejects(
    createSectionUseCase(
      { campusId: "campus_1", programId: selectedProgram.id, classId: academicClass.id, name: "Section A" },
      createSectionContext(),
      { repository, programRepository, classRepository },
    ),
    (error: unknown) => error instanceof BadRequestError && /selected program/.test(error.message),
  );
});
