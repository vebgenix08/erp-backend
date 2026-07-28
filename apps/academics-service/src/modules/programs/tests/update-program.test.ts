import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryProgramRepository } from "../programs.repository";
import { createProgramUseCase, updateProgramUseCase } from "../use-cases";
import { createProgramContext } from "./fixtures";

test("update program changes fields and preserves tenant isolation", async () => {
  const repository = new InMemoryProgramRepository();
  const created = await createProgramUseCase({ campusId: "campus_1", code: "BCA", name: "Bachelor of Computer Applications" }, createProgramContext(), { repository });

  const updated = await updateProgramUseCase(
    created.id,
    { name: "Bachelor of Computer Application", status: "INACTIVE" },
    createProgramContext({ method: "PUT", path: `/programs/${created.id}` }),
    { repository },
  );

  assert.equal(updated?.name, "Bachelor of Computer Application");
  assert.equal(updated?.status, "INACTIVE");
  assert.ok(updated?.deactivatedAt);
});
