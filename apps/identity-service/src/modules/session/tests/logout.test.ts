import test from "node:test";
import assert from "node:assert/strict";
import { createSessionContext } from "./fixtures";
import { logoutUseCase } from "../use-cases";

test("logout returns success", async () => {
  const result = await logoutUseCase(createSessionContext());
  assert.equal(result.success, true);
});
