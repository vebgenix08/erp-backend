import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryPlanningStore } from "../planning-store.repository";
test("planning store cannot read or replace another tenant record", async () => {
  const store = new InMemoryPlanningStore(), document = { _id: "room_1", id: "room_1", tenantId: "tenant_one", version: 1, status: "ACTIVE" };
  await store.insert("rooms", "tenant_one", document);
  assert.equal(await store.get("rooms", "tenant_two", "room_1"), null);
  assert.equal(await store.replace("rooms", "tenant_two", "room_1", 1, { ...document, tenantId: "tenant_two" }), null);
  assert.equal((await store.list("rooms", "tenant_one")).length, 1);
});
