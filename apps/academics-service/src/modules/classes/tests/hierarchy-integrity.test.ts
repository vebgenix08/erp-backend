import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestError } from "@school-erp/errors";
import { InMemoryProgramRepository } from "../../programs/programs.repository";
import { InMemoryClassRepository } from "../classes.repository";
import { createClassUseCase } from "../use-cases";
import { createClassContext } from "./fixtures";

test("class rejects a program owned by another campus", async () => {
  const repository = new InMemoryClassRepository();
  const programRepository = new InMemoryProgramRepository();
  const program = await programRepository.create("tenant_1", { campusId: "campus_2", academicUnitId: "unit_college", code: "PROG-001", name: "College Program" });

  await assert.rejects(
    createClassUseCase(
      { campusId: "campus_1", programId: program.id, name: "Grade 1" },
      createClassContext(),
      { repository, programRepository },
    ),
    (error: unknown) => error instanceof BadRequestError && /selected campus/.test(error.message),
  );
});
