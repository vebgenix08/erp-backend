import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFeatureFlagRepository } from "../feature-flags.repository";
import { createFeatureFlag, listFeatureFlags } from "../feature-flags.service";
import { createFeatureFlagContext } from "./fixtures";

test("list feature flags returns records sorted by code", async () => {
  const repository = new InMemoryFeatureFlagRepository();
  await createFeatureFlag({ code: "B", name: "B" }, createFeatureFlagContext(), { repository });
  await createFeatureFlag({ code: "A", name: "A" }, createFeatureFlagContext(), { repository });

  const result = await listFeatureFlags(createFeatureFlagContext(), { repository });

  assert.equal(JSON.stringify(result.map((item) => item?.code)), JSON.stringify(["A", "B"]));
});
