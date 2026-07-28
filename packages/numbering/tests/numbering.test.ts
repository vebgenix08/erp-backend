import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber } from "../src";

test("formats a configurable document number", () => {
  assert.equal(
    formatNumber(
      { format: "STU/{YEAR}/{SEQUENCE}", padding: 6 },
      1,
      { at: new Date("2026-07-28T00:00:00Z") },
    ),
    "STU/2026/000001",
  );
});

test("formats academic year and campus tokens", () => {
  assert.equal(
    formatNumber(
      { format: "RCP/{CAMPUS_CODE}/{ACADEMIC_YEAR}/{SEQUENCE}", padding: 5 },
      42,
      { campusCode: "MAIN", academicYearCode: "26-27" },
    ),
    "RCP/MAIN/26-27/00042",
  );
});
