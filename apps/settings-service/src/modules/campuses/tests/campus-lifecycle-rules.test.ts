import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryCampusRepository } from "../campuses.repository";
import { createCampus, deactivateCampus, reactivateCampus } from "../campuses.service";

function context() {
  return createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: { user: { id: "user-1", permissions: ["settings.campuses.create", "settings.campuses.deactivate", "settings.campuses.activate"] }, source: "request", authenticatedAt: new Date() } as any,
  }) as any;
}

test("normalized campus names are unique within a tenant", async () => {
  const repository = new InMemoryCampusRepository();
  await createCampus(context(), { name: "Main Campus" }, { repository });
  await assert.rejects(() => createCampus(context(), { name: "  main   campus " }, { repository }), /campus name must be unique/);
});

test("the only active campus cannot be deactivated", async () => {
  const repository = new InMemoryCampusRepository();
  const campus = await createCampus(context(), { name: "Main Campus" }, { repository });
  await assert.rejects(() => deactivateCampus(context(), campus.id, { repository }), /only active campus/);
});

test("an inactive campus can be reactivated", async () => {
  const repository = new InMemoryCampusRepository();
  const first = await createCampus(context(), { name: "Main Campus" }, { repository });
  await createCampus(context(), { name: "North Campus" }, { repository });
  await deactivateCampus(context(), first.id, { repository });
  const restored = await reactivateCampus(context(), first.id, { repository });
  assert.equal(restored?.status, "ACTIVE");
  assert.equal(restored?.deactivatedAt, undefined);
});
