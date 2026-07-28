import assert from "node:assert/strict";
import test from "node:test";
import { createMockRequestContext } from "@school-erp/test-utils";
import { InMemoryAcademicYearRepository } from "../../academic-years/academic-years.repository";
import { InMemoryCampusRepository } from "../../campuses/campuses.repository";
import { InMemoryInstitutionRepository } from "../../institution/institution.repository";
import { InMemoryTemplateRepository } from "../../templates/templates.repository";
import { getTenantReadiness } from "../readiness.service";

const context = createMockRequestContext({ tenantContext: { tenantId: "tenant_1" } as any, authContext: { source: "request", authenticatedAt: new Date(), user: { id: "user_1", permissions: ["settings.readiness.read"] } } as any });

test("readiness is derived from authoritative setup records", async () => {
  const institution = new InMemoryInstitutionRepository();
  const campuses = new InMemoryCampusRepository();
  const academicYears = new InMemoryAcademicYearRepository();
  const templates = new InMemoryTemplateRepository();
  const deps = { institution, campuses, academicYears, templates, now: () => new Date("2026-07-21T00:00:00.000Z") };
  assert.equal((await getTenantReadiness(context as any, deps)).ready, false);
  await institution.create("tenant_1", { name: "Vebgenix College" });
  await campuses.create("tenant_1", { name: "Main Campus", campusType: "COLLEGE", code: "CAMP-001" });
  const year = await academicYears.create("tenant_1", { code: "2026-27", name: "2026-27", startDate: "2026-06-01", endDate: "2027-05-31" });
  await academicYears.activate("tenant_1", year.id);
  const readiness = await getTenantReadiness(context as any, deps);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.percentage, 100);
  assert.equal(readiness.items.find((item) => item.key === "PUBLISHED_TEMPLATE")?.status, "OPTIONAL");
});
