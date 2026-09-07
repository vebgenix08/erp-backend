import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "@school-erp/errors";
import { InMemoryNumberingEngineRepository } from "../numbering-engine.repository";
import { issueNumbers } from "../numbering-engine.service";

function repository() {
  const value = new InMemoryNumberingEngineRepository();
  value.seedPolicy({
    _id: "numbering_tenant_1_RECEIPT",
    id: "numbering_tenant_1_RECEIPT",
    tenantId: "tenant_1",
    stream: "RECEIPT",
    format: "RCP/{CAMPUS_CODE}/{ACADEMIC_YEAR}/{SEQUENCE}",
    padding: 5,
    scope: "CAMPUS",
    reset: "ACADEMIC_YEAR",
    active: true,
    version: 2,
    nextNumber: 1,
    issuedCount: 0,
    updatedAt: new Date("2026-08-01T00:00:00Z"),
  });
  return value;
}

test("issues idempotent tenant and campus scoped numbers", async () => {
  const target = repository();
  const context = {
    tenantId: "tenant_1",
    stream: "RECEIPT" as const,
    idempotencyKey: "payment_1",
    campusId: "campus_1",
    campusCode: "MAIN",
    academicYearId: "year_1",
    academicYearCode: "2026-27",
  };
  const first = await target.issue(context);
  const repeated = await target.issue(context);
  const second = await target.issue({ ...context, idempotencyKey: "payment_2" });
  assert.equal(first, "RCP/MAIN/2026-27/00001");
  assert.equal(repeated, first);
  assert.equal(second, "RCP/MAIN/2026-27/00002");
});

test("requires the scope demanded by the configured policy", async () => {
  const target = repository();
  let thrown: unknown;
  try {
    await target.issue({
      tenantId: "tenant_1",
      stream: "RECEIPT",
      idempotencyKey: "payment_1",
      academicYearId: "year_1",
    });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof ConflictError);
});

test("cancels without reusing the issued number", async () => {
  const target = repository();
  const context = {
    tenantId: "tenant_1",
    stream: "RECEIPT" as const,
    idempotencyKey: "payment_1",
    campusId: "campus_1",
    campusCode: "MAIN",
    academicYearId: "year_1",
    academicYearCode: "2026-27",
  };
  const issued = await target.issue(context);
  assert.equal(await target.cancel(context, "payment reversed"), issued);
  assert.equal(await target.cancel(context, "payment reversed"), issued);
  assert.equal(
    await target.issue({ ...context, idempotencyKey: "payment_2" }),
    "RCP/MAIN/2026-27/00002",
  );
});

test("allows the same roll number in different section scopes", async () => {
  const target = new InMemoryNumberingEngineRepository();
  target.seedPolicy({
    _id: "numbering_tenant_1_ROLL_NUMBER",
    id: "numbering_tenant_1_ROLL_NUMBER",
    tenantId: "tenant_1",
    stream: "ROLL_NUMBER",
    format: "{SEQUENCE}",
    padding: 2,
    scope: "SECTION",
    reset: "ACADEMIC_YEAR",
    active: true,
    version: 1,
    nextNumber: 1,
    issuedCount: 0,
    updatedAt: new Date("2026-08-01T00:00:00Z"),
  });

  const base = {
    tenantId: "tenant_1",
    stream: "ROLL_NUMBER" as const,
    academicYearId: "year_1",
  };
  const sectionA = await target.issue({
    ...base,
    idempotencyKey: "enrollment_1",
    sectionId: "section_a",
  });
  const sectionB = await target.issue({
    ...base,
    idempotencyKey: "enrollment_2",
    sectionId: "section_b",
  });

  assert.equal(sectionA, "01");
  assert.equal(sectionB, "01");
});

test("issues a deterministic ordered batch through one numbering repository", async () => {
  const target = repository();
  const numbers = await issueNumbers(
    ["student_1", "student_2", "student_3"].map((studentId) => ({
      tenantId: "tenant_1",
      stream: "RECEIPT",
      idempotencyKey: studentId,
      campusId: "campus_1",
      campusCode: "MAIN",
      academicYearId: "year_1",
      academicYearCode: "2026-27",
    })),
    target,
  );

  assert.equal(
    JSON.stringify(numbers),
    JSON.stringify(["RCP/MAIN/2026-27/00001", "RCP/MAIN/2026-27/00002", "RCP/MAIN/2026-27/00003"]),
  );
});
