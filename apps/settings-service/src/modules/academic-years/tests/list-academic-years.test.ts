import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryAcademicYearRepository } from "../academic-years.repository";
import { createAcademicYearUseCase, listAcademicYearsUseCase } from "../use-cases";
import { createAcademicYearFixture } from "./fixtures";

test("list academic years returns records sorted by start date", async () => {
  const repository = new InMemoryAcademicYearRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.academicyears.create", "settings.academicyears.read"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  await createAcademicYearUseCase(context as any, createAcademicYearFixture({ code: "2026-27", name: "2026-27", startDate: "2026-06-01", endDate: "2027-05-31" }), { repository });
  await createAcademicYearUseCase(context as any, createAcademicYearFixture({ code: "2025-26", name: "2025-26", startDate: "2025-06-01", endDate: "2026-05-31" }), { repository });
  const results = await listAcademicYearsUseCase(context as any, { repository });
  assert.equal(results[0]?.code, "2025-26");
});
