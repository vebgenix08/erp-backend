import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryCognitoSyncRepository } from "../cognito-sync.repository";
import { createCognitoSyncUseCase, listCognitoSyncUseCase } from "../use-cases";
import { createCognitoSyncContext } from "./fixtures";

test("list cognito sync returns tenant scoped results", async () => {
  const repository = new InMemoryCognitoSyncRepository();
  await createCognitoSyncUseCase({ userId: "user_abc", email: "teacher@example.test" }, createCognitoSyncContext(), { repository });
  const records = await listCognitoSyncUseCase(createCognitoSyncContext(), { repository });
  assert.equal(records.length, 1);
});
