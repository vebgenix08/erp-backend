import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryCognitoSyncRepository } from "../cognito-sync.repository";
import { createCognitoSyncUseCase, deleteCognitoSyncUseCase, listCognitoSyncUseCase } from "../use-cases";
import { createCognitoSyncContext } from "./fixtures";

test("delete cognito sync removes the record", async () => {
  const repository = new InMemoryCognitoSyncRepository();
  const created = await createCognitoSyncUseCase({ userId: "user_abc", email: "teacher@example.test" }, createCognitoSyncContext(), { repository });
  const deleted = await deleteCognitoSyncUseCase(created.id, createCognitoSyncContext(), { repository });
  const records = await listCognitoSyncUseCase(createCognitoSyncContext(), { repository });
  assert.equal(deleted, true);
  assert.equal(records.length, 0);
});
