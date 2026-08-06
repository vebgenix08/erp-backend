import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { addSubjectBatchMembership, createSubjectBatch, createSubjectChoiceGroup, createSubjectOfferingRecord, selectStudentSubject } from "../learning-delivery.service";
const context: RequestContext = { requestId: "request", path: "graphql", method: "POST", headers: {}, query: {}, params: {}, body: {}, tenantContext: { tenantId: "tenant", source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", source: "jwt-claims", permissions: ["academics.subject-choice-group.manage", "academics.student-subject-choice.manage", "academics.subject-batch.manage", "academics.subject-offering.manage"] } } };
const seed = async (store: InMemoryPlanningStore, collection: "curriculum_subjects" | "academic_year_subject_plans" | "subject_components" | "academics_sections", id: string) => store.insert(collection, "tenant", { _id: id, id, tenantId: "tenant", status: "ACTIVE", version: 1 });
test("typed delivery use cases persist a subject batch, membership and offering", async () => {
  const store = new InMemoryPlanningStore(); await seed(store, "curriculum_subjects", "kannada"); await seed(store, "curriculum_subjects", "sanskrit"); await seed(store, "academic_year_subject_plans", "plan"); await seed(store, "subject_components", "component"); await seed(store, "academics_sections", "a"); await seed(store, "academics_sections", "b");
  const choiceGroup = await createSubjectChoiceGroup({ campusId: "campus", academicYearId: "year", academicUnitId: "school", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", name: "Second Language", code: "SECOND_LANG", minimumSelections: 1, maximumSelections: 1, optionCurriculumSubjectIds: ["kannada", "sanskrit"] }, context, { store });
  await selectStudentSubject({ academicYearId: "year", studentId: "student", enrollmentId: "enrollment", choiceGroupId: choiceGroup.id, curriculumSubjectId: "kannada", effectiveFrom: "2026-06-01" }, context, { store });
  const batch = await createSubjectBatch({ campusId: "campus", academicYearId: "year", academicUnitId: "school", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", curriculumSubjectId: "kannada", subjectComponentId: "component", batchType: "LANGUAGE", name: "Class 10 Kannada Batch", code: "G10-KAN", sourceSectionIds: ["a", "b"], effectiveFrom: "2026-06-01" }, context, { store });
  await addSubjectBatchMembership({ subjectBatchId: batch.id, studentId: "student", enrollmentId: "enrollment", membershipSource: "SUBJECT_CHOICE", effectiveFrom: "2026-06-01" }, context, { store });
  const offering = await createSubjectOfferingRecord({ campusId: "campus", academicYearId: "year", subjectPlanId: "plan", curriculumSubjectId: "kannada", subjectComponentId: "component", targetType: "SUBJECT_BATCH", subjectBatchId: batch.id, requiredPeriodsPerWeek: 4, requiredConsecutiveSlots: 1, effectiveFrom: "2026-06-01" }, context, { store });
  assert.equal(offering.readinessStatus, "INCOMPLETE");
  assert.equal(offering.targetType, "SUBJECT_BATCH");
  assert.equal((await store.list("subject_batch_memberships", "tenant")).length, 1);
});
