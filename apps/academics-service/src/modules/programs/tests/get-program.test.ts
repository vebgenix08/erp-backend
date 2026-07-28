import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgramRepository } from "../programs.repository";
import { createProgramUseCase, getProgramUseCase } from "../use-cases";
import { createProgramContext } from "./fixtures";

test("get program returns the existing tenant record", async () => {
  const repository = new InMemoryProgramRepository();
  const created = await createProgramUseCase({ campusId: "campus_1", code: "MBA", name: "Master of Business Administration" }, createProgramContext(), { repository });

  const result = await getProgramUseCase(created.id, createProgramContext({ method: "GET", path: `/programs/${created.id}` }), { repository });

  assert.equal(result?.id, created.id);
  assert.equal(result?.name, "Master of Business Administration");
});
