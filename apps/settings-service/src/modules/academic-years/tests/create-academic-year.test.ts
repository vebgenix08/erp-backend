import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryAcademicYearRepository } from "../academic-years.repository";
import { createAcademicYearUseCase } from "../use-cases";
import { createAcademicYearFixture } from "./fixtures";

test("create academic year stores the record", async () => {
  const repository = new InMemoryAcademicYearRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.academicyears.create"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const result = await createAcademicYearUseCase(context as any, createAcademicYearFixture(), { repository });
  assert.equal(result.code, "2025-26");
  assert.equal(result.status, "INACTIVE");
});
