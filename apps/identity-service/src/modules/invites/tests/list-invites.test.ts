import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryInviteDelivery } from "@school-erp/comms";
import { InMemoryInviteRepository } from "../invites.repository";
import { createInviteUseCase, listInvitesUseCase } from "../use-cases";
import { createInviteContext } from "./fixtures";

test("list invites filters by search and status", async () => {
  const repository = new InMemoryInviteRepository();
  const delivery = createInMemoryInviteDelivery();
  await createInviteUseCase({ email: "alpha@example.test", role: "TEACHER", fullName: "Alpha User" }, createInviteContext(), {
    repository,
    delivery,
  });
  await createInviteUseCase({ email: "beta@example.test", role: "ACCOUNTANT", fullName: "Beta User" }, createInviteContext(), {
    repository,
    delivery,
  });

  const all = await listInvitesUseCase(createInviteContext(), { repository, delivery }, {});
  assert.equal(all.length, 2);

  const teacherOnly = await listInvitesUseCase(createInviteContext(), { repository, delivery }, { role: "TEACHER" });
  assert.equal(teacherOnly.length, 1);
  assert.equal(teacherOnly[0]?.email, "alpha@example.test");

  const search = await listInvitesUseCase(createInviteContext(), { repository, delivery }, { search: "beta" });
  assert.equal(search.length, 1);
  assert.equal(search[0]?.email, "beta@example.test");
});
