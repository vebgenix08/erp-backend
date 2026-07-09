import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryAcademicYearRepository } from "../academic-years.repository";
import { activateAcademicYearUseCase, createAcademicYearUseCase } from "../use-cases";
import { createAcademicYearFixture } from "./fixtures";

test("activate academic year marks it active", async () => {
  const repository = new InMemoryAcademicYearRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.academicyears.create", "settings.academicyears.activate"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const created = await createAcademicYearUseCase(context as any, createAcademicYearFixture(), { repository });
  const activated = await activateAcademicYearUseCase(context as any, created.id, { repository });
  assert.equal(activated?.status, "ACTIVE");
});
