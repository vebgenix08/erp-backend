import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryCognitoSyncRepository } from "../cognito-sync.repository";
import { createCognitoSyncUseCase, updateCognitoSyncUseCase } from "../use-cases";
import { createCognitoSyncContext } from "./fixtures";

test("update cognito sync changes status", async () => {
  const repository = new InMemoryCognitoSyncRepository();
  const created = await createCognitoSyncUseCase({ userId: "user_abc", email: "teacher@example.test" }, createCognitoSyncContext(), { repository });
  const updated = await updateCognitoSyncUseCase(created.id, { status: "SYNCED" }, createCognitoSyncContext(), { repository });
  assert.equal(updated?.status, "SYNCED");
});
