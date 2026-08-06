import assert from "node:assert/strict";
import test from "node:test";
import { InMemorySubjectComponentRepository } from "../subject-components.repository";
import { InMemoryAcademicYearSubjectPlanRepository } from "../../academic-year-subject-plans/academic-year-subject-plans.repository";
import { activateSubjectPlan } from "../../academic-year-subject-plans/academic-year-subject-plans.service";
import { validateAcademicYearSubjectPlan } from "../../academic-year-subject-plans/academic-year-subject-plans.validator";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import type { RequestContext } from "@school-erp/api";
test("mixed delivery is represented by separate components", async () => {
  const repository = new InMemorySubjectComponentRepository();
  const theory = await repository.create("tenant", "admin", { curriculumSubjectId: "physics", componentType: "THEORY", baselinePeriodsPerWeek: 5 });
  const practical = await repository.create("tenant", "admin", { curriculumSubjectId: "physics", componentType: "PRACTICAL", baselinePeriodsPerWeek: 2, preferredSessionLength: 2, requiresConsecutivePeriods: true, workloadMultiplier: 1.5 });
  assert.equal(theory.preferredSessionLength, 1); assert.equal(practical.requiresConsecutivePeriods, true);
  await assert.rejects(() => repository.create("tenant", "admin", { curriculumSubjectId: "physics", componentType: "THEORY" }), /already exists/);
});
test("year plan owns a bounded component plan and activates once", async () => {
  const repository = new InMemoryAcademicYearSubjectPlanRepository();
  const plan = await repository.create("tenant", "admin", { campusId: "campus", academicYearId: "year", academicUnitId: "unit", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", curriculumSubjectId: "physics", appliesToAllSections: true, componentPlans: [{ subjectComponentId: "theory", plannedPeriodsPerWeek: 5, preferredSessionLength: 1, isOverride: false }] });
  assert.equal(plan.status, "DRAFT"); assert.equal((await repository.activate("tenant", "admin", plan.id))?.status, "ACTIVE");
  await assert.rejects(() => repository.activate("tenant", "admin", plan.id), /only a draft/);
});
test("subject plan validator reads a nested component identifier", () => {
  const plan = validateAcademicYearSubjectPlan({ campusId: "campus", academicYearId: "year", academicUnitId: "unit", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", curriculumSubjectId: "physics", appliesToAllSections: true, componentPlans: [{ subjectComponentId: "theory", plannedPeriodsPerWeek: 5, preferredSessionLength: 1, isOverride: false }] });
  assert.equal(plan.componentPlans[0]?.subjectComponentId, "theory");
});
test("activating an all-section plan creates direct section offerings without section groups", async () => {
  const repository = new InMemoryAcademicYearSubjectPlanRepository(), componentRepository = new InMemorySubjectComponentRepository(), store = new InMemoryPlanningStore(), context: RequestContext = { requestId: "request", path: "graphql", method: "POST", headers: {}, query: {}, params: {}, body: {}, tenantContext: { tenantId: "tenant", source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", source: "jwt-claims", permissions: ["academics.subject-plan.activate"] } } };
  const component = await componentRepository.create("tenant", "admin", { curriculumSubjectId: "physics", componentType: "THEORY" });
  await store.insert("academics_sections", "tenant", { _id: "section_a", id: "section_a", tenantId: "tenant", campusId: "campus", classId: "grade10", name: "Grade 10-A", code: "G10-A", status: "ACTIVE", version: 1 });
  const plan = await repository.create("tenant", "admin", { campusId: "campus", academicYearId: "year", academicUnitId: "unit", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", curriculumSubjectId: "physics", appliesToAllSections: true, componentPlans: [{ subjectComponentId: component.id, plannedPeriodsPerWeek: 5, preferredSessionLength: 1, isOverride: false }] });
  await activateSubjectPlan(plan.id, context, { repository, componentRepository, planningStore: store });
  await activateSubjectPlan(plan.id, context, { repository, componentRepository, planningStore: store });
  const offerings = await store.list("subject_offerings", "tenant");
  assert.equal((await store.list("teaching_groups", "tenant")).length, 0);
  assert.equal(offerings.length, 1);
  assert.equal(offerings[0]?.targetType, "SECTION");
  assert.equal(offerings[0]?.sectionId, "section_a");
  assert.equal(offerings[0]?.teachingGroupId, undefined);
});
