import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryFeatureFlagRepository } from "../feature-flags.repository";
import { createFeatureFlag } from "../feature-flags.service";
import { createFeatureFlagContext } from "./fixtures";

test("create feature flag stores enabled flag", async () => {
  const repository = new InMemoryFeatureFlagRepository();
  const result = await createFeatureFlag(
    { code: "ADMISSIONS_PORTAL", name: "Admissions Portal", isEnabled: true },
    createFeatureFlagContext(),
    { repository },
  );

  assert.equal(result?.code, "ADMISSIONS_PORTAL");
  assert.equal(result?.isEnabled, true);
});
