import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryCognitoSyncRepository } from "../cognito-sync.repository";
import { createCognitoSyncUseCase, getCognitoSyncUseCase } from "../use-cases";
import { createCognitoSyncContext } from "./fixtures";

test("get cognito sync returns the created record", async () => {
  const repository = new InMemoryCognitoSyncRepository();
  const created = await createCognitoSyncUseCase(
    { userId: "user_abc", email: "teacher@example.test" },
    createCognitoSyncContext(),
    { repository },
  );

  const fetched = await getCognitoSyncUseCase(created.id, createCognitoSyncContext(), { repository });
  assert.equal(fetched?.id, created.id);
});
