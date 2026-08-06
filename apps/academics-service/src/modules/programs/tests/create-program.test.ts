import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgramRepository } from "../programs.repository";
import { createProgramUseCase } from "../use-cases";
import { createProgramContext } from "./fixtures";

test("create program stores a tenant-scoped active record", async () => {
  const repository = new InMemoryProgramRepository();
  const result = await createProgramUseCase(
    { campusId: "campus_1", academicUnitId: "unit_degree", code: "CLIENT-CODE-MUST-BE-IGNORED", name: "B.Sc Computer Science", description: "UG program" },
    createProgramContext(),
    { repository },
  );

  assert.equal(result.code, "PROG-001");
  assert.equal(result.status, "ACTIVE");
  const stored = await repository.getByCode("tenant_1", "campus_1", "PROG-001");
  assert.equal(stored?.name, "B.Sc Computer Science");
});
