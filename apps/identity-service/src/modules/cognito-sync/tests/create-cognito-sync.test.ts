import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryCognitoSyncRepository } from "../cognito-sync.repository";
import { createCognitoSyncUseCase } from "../use-cases";
import { createCognitoSyncContext } from "./fixtures";

test("create cognito sync stores a tenant-scoped record", async () => {
  const repository = new InMemoryCognitoSyncRepository();
  const result = await createCognitoSyncUseCase(
    {
      userId: "user_abc",
      email: "teacher@example.test",
      cognitoUsername: "teacher@example.test",
    },
    createCognitoSyncContext(),
    { repository },
  );

  assert.equal(result?.userId, "user_abc");
  assert.equal(result?.status, "PENDING");
});
