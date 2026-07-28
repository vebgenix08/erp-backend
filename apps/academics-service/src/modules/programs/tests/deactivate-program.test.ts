import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgramRepository } from "../programs.repository";
import { createProgramUseCase, deactivateProgramUseCase } from "../use-cases";
import { createProgramContext } from "./fixtures";

test("deactivate program marks the record inactive", async () => {
  const repository = new InMemoryProgramRepository();
  const created = await createProgramUseCase({ campusId: "campus_1", code: "BA", name: "Bachelor of Arts" }, createProgramContext(), { repository });

  const result = await deactivateProgramUseCase(created.id, createProgramContext({ method: "POST", path: `/programs/${created.id}/deactivate` }), { repository });

  assert.equal(result?.status, "INACTIVE");
  assert.ok(result?.deactivatedAt);
});
