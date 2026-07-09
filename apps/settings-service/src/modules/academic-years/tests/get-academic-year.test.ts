import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryAcademicYearRepository } from "../academic-years.repository";
import { createAcademicYearUseCase, getAcademicYearUseCase } from "../use-cases";
import { createAcademicYearFixture } from "./fixtures";

test("get academic year returns stored record", async () => {
  const repository = new InMemoryAcademicYearRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.academicyears.create", "settings.academicyears.read"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const created = await createAcademicYearUseCase(context as any, createAcademicYearFixture(), { repository });
  const result = await getAcademicYearUseCase(context as any, created.id, { repository });
  assert.equal(result?.code, "2025-26");
});
