import test from "node:test";
import assert from "node:assert/strict";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryAcademicYearRepository } from "../academic-years.repository";
import { createAcademicYearUseCase, updateAcademicYearUseCase } from "../use-cases";
import { createAcademicYearFixture } from "./fixtures";

test("update academic year changes fields", async () => {
  const repository = new InMemoryAcademicYearRepository();
  const context = createMockRequestContext({
    tenantContext: { tenantId: "tenant-1" } as any,
    authContext: {
      user: { id: "user-1", permissions: ["settings.academicyears.create", "settings.academicyears.update"] },
      source: "request",
      authenticatedAt: new Date(),
    } as any,
  });
  const created = await createAcademicYearUseCase(context as any, createAcademicYearFixture(), { repository });
  const updated = await updateAcademicYearUseCase(context as any, created.id, { name: "Updated Year" }, { repository });
  assert.equal(updated?.name, "Updated Year");
});
