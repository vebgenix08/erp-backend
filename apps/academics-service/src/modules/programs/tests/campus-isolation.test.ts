import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgramRepository } from "../programs.repository";
import { createProgramUseCase, listProgramsUseCase } from "../use-cases";
import { createProgramContext } from "./fixtures";

test("program listing isolates campuses within the same tenant", async () => {
  const repository = new InMemoryProgramRepository();
  const context = createProgramContext();
  await createProgramUseCase({ campusId: "campus_school", academicUnitId: "unit_school", name: "Primary School" }, context, { repository });
  await createProgramUseCase({ campusId: "campus_college", academicUnitId: "unit_degree", name: "Bachelor of Commerce" }, context, { repository });

  const schoolPrograms = await listProgramsUseCase(context, { repository }, { campusId: "campus_school" });
  const collegePrograms = await listProgramsUseCase(context, { repository }, { campusId: "campus_college" });

  assert.deepEqual(schoolPrograms.map((item) => item.name), ["Primary School"]);
  assert.deepEqual(collegePrograms.map((item) => item.name), ["Bachelor of Commerce"]);
  assert.equal(schoolPrograms[0]?.code, "PROG-001");
  assert.equal(collegePrograms[0]?.code, "PROG-001");
});
