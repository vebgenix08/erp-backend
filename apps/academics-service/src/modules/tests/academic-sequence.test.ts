import assert from "node:assert/strict";
import test from "node:test";
import { academicSequenceFilter } from "../academic-sequence";

test("academic sequence ownership is encoded in the atomic Mongo key", () => {
  assert.deepEqual(academicSequenceFilter("section", "tenant_1", "campus_1"), {
    _id: "section:tenant_1:campus_1",
  });
});

test("academic sequence key requires tenant and campus context", () => {
  assert.throws(() => academicSequenceFilter("class", "", "campus_1"), /tenantId/);
  assert.throws(() => academicSequenceFilter("subject", "tenant_1", ""), /campusId/);
});
