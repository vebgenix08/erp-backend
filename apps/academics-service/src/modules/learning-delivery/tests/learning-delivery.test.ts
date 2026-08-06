import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryLearningDeliveryRepository } from "../learning-delivery.repository";
test("legacy section group creation remains idempotent during migration", () => {
  const repository = new InMemoryLearningDeliveryRepository(), base = { campusId: "campus", academicYearId: "year", academicUnitId: "school", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", type: "SECTION" as const, name: "Grade 10-A", code: "G10-A", homeSectionId: "section_a", effectiveFrom: new Date(), status: "ACTIVE" as const };
  const first = repository.ensureSectionGroup("tenant", "admin", base), second = repository.ensureSectionGroup("tenant", "admin", base);
  assert.equal(first.id, second.id);
});
test("language choice creates membership without changing home section", () => {
  const repository = new InMemoryLearningDeliveryRepository();
  const choiceGroup = repository.createChoiceGroup("tenant", "admin", { campusId: "campus", academicYearId: "year", academicUnitId: "school", curriculumId: "cbse", programId: "school", academicLevelId: "grade10", name: "Second Language", code: "SECOND_LANG", minimumSelections: 1, maximumSelections: 1, optionCurriculumSubjectIds: ["kannada", "sanskrit"], status: "ACTIVE" });
  const input = { academicYearId: "year", studentId: "student", enrollmentId: "enrollment", choiceGroupId: choiceGroup.id, curriculumSubjectId: "kannada", effectiveFrom: new Date(), status: "ACTIVE" as const, selectedBy: "admin" };
  const choice = repository.createStudentChoice("tenant", "admin", input);
  assert.equal(choice.curriculumSubjectId, "kannada");
  assert.throws(() => repository.createStudentChoice("tenant", "admin", { ...input, curriculumSubjectId: "sanskrit" }), /already has/);
});
test("offering targets a section directly and parallel blocks require multiple offerings", () => {
  const repository = new InMemoryLearningDeliveryRepository();
  const offering = repository.createOffering("tenant", "admin", { campusId: "campus", academicYearId: "year", subjectPlanId: "plan", curriculumSubjectId: "kannada", subjectComponentId: "theory", targetType: "SECTION", sectionId: "section_a", requiredPeriodsPerWeek: 4, requiredConsecutiveSlots: 1, preferredSessionLength: 1, requiresConsecutivePeriods: false, effectiveFrom: new Date(), readinessStatus: "INCOMPLETE", status: "ACTIVE" });
  assert.equal(offering.sectionId, "section_a");
  assert.throws(() => repository.createParallelBlock("tenant", "admin", { campusId: "campus", academicYearId: "year", academicUnitId: "school", programId: "school", academicLevelId: "grade10", name: "Languages", code: "LANG", type: "LANGUAGE", sourceSectionIds: ["a", "b"], requiredOfferingIds: [offering.id], mustRunSimultaneously: true, status: "ACTIVE" }), /at least two/);
});
