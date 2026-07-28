import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryInviteDelivery } from "@school-erp/comms";
import { InMemoryInviteRepository } from "../invites.repository";
import { createInviteUseCase, updateInviteUseCase } from "../use-cases";
import { createInviteContext } from "./fixtures";

test("update invite changes mutable fields", async () => {
  const repository = new InMemoryInviteRepository();
  const delivery = createInMemoryInviteDelivery();
  const created = await createInviteUseCase(
    { email: "update@example.test", role: "TEACHER", fullName: "Old Name" },
    createInviteContext(),
    { repository, delivery },
  );

  const updated = await updateInviteUseCase(created.id, { fullName: "New Name", role: "SENIOR_TEACHER" }, createInviteContext(), {
    repository,
    delivery,
  });

  assert.equal(updated?.fullName, "New Name");
  assert.equal(updated?.role, "SENIOR_TEACHER");
});
