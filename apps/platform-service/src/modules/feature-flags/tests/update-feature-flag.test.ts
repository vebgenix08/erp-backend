import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFeatureFlagRepository } from "../feature-flags.repository";
import { createFeatureFlag, updateFeatureFlag } from "../feature-flags.service";
import { createFeatureFlagContext } from "./fixtures";

test("update feature flag toggles enabled state", async () => {
  const repository = new InMemoryFeatureFlagRepository();
  const created = await createFeatureFlag({ code: "STUDENT_PORTAL", name: "Student Portal", isEnabled: false }, createFeatureFlagContext(), { repository });

  const updated = await updateFeatureFlag(created!.id, { isEnabled: true }, createFeatureFlagContext({ method: "PUT" }), { repository });

  assert.equal(updated?.isEnabled, true);
});
