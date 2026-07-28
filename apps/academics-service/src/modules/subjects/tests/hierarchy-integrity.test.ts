import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestError } from "@school-erp/errors";
import { InMemoryProgramRepository } from "../../programs/programs.repository";
import { InMemoryClassRepository } from "../../classes/classes.repository";
import { InMemorySubjectRepository } from "../subjects.repository";
import { createSubjectUseCase } from "../use-cases";
import { createSubjectContext } from "./fixtures";

test("subject rejects a class owned by another campus", async () => {
  const repository = new InMemorySubjectRepository();
  const programRepository = new InMemoryProgramRepository();
  const classRepository = new InMemoryClassRepository();
  const campusOneProgram = await programRepository.create("tenant_1", { campusId: "campus_1", code: "PROG-001", name: "Primary" });
  const campusTwoProgram = await programRepository.create("tenant_1", { campusId: "campus_2", code: "PROG-001", name: "College" });
  const campusTwoClass = await classRepository.create("tenant_1", { campusId: "campus_2", programId: campusTwoProgram.id, code: "CLASS-001", name: "Semester 1" });

  await assert.rejects(
    createSubjectUseCase(
      { campusId: "campus_1", programId: campusOneProgram.id, classId: campusTwoClass.id, name: "English", subjectType: "THEORY" },
      createSubjectContext(),
      { repository, programRepository, classRepository },
    ),
    (error: unknown) => error instanceof BadRequestError && /selected campus/.test(error.message),
  );
});
