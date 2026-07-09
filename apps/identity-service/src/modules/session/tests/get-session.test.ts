import test from "node:test";
import assert from "node:assert/strict";
import { createSessionContext } from "./fixtures";
import { getSessionUseCase } from "../use-cases";

test("get session returns auth and tenant snapshots", async () => {
  const result = await getSessionUseCase(createSessionContext());
  assert.equal(result.user.id, "user_test_1");
  assert.equal(result.tenant?.tenantId, "tenant_test_1");
});
