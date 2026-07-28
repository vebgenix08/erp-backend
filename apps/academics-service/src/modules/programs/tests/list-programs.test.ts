import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgramRepository } from "../programs.repository";
import { createProgramUseCase, listProgramsUseCase } from "../use-cases";
import { createProgramContext } from "./fixtures";

test("list programs returns tenant-only results", async () => {
  const repository = new InMemoryProgramRepository();
  await createProgramUseCase({ campusId: "campus_1", code: "BSC", name: "B.Sc" }, createProgramContext(), { repository });
  await createProgramUseCase({ campusId: "campus_1", code: "MSC", name: "M.Sc" }, createProgramContext(), { repository });

  const result = await listProgramsUseCase(createProgramContext(), { repository }, { campusId: "campus_1" });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.code),
    ["PROG-001", "PROG-002"],
  );
});
