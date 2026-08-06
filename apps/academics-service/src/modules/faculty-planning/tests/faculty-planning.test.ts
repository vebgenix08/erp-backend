import assert from "node:assert/strict";
import test from "node:test";
import { calculateWorkload, InMemoryFacultyPlanningRepository } from "../faculty-planning.repository";
import { normalizeOfferingAssignmentStatus } from "../faculty-planning.service";
test("one employee can teach across campuses but primary assignments cannot overlap", () => {
  const repository = new InMemoryFacultyPlanningRepository(), effectiveFrom = new Date("2026-06-01");
  repository.assignCampus("tenant", "admin", { employeeId: "teacher", campusId: "a", assignmentType: "PRIMARY", availableForTeaching: true, effectiveFrom, approvedBy: "admin", status: "ACTIVE" });
  repository.assignCampus("tenant", "admin", { employeeId: "teacher", campusId: "b", assignmentType: "SHARED_FACULTY", availableForTeaching: true, effectiveFrom, approvedBy: "admin", status: "ACTIVE" });
  repository.addEligibility("tenant", "admin", { employeeId: "teacher", subjectCatalogueId: "maths", effectiveFrom, status: "ACTIVE" });
  const input = { subjectOfferingId: "offering", employeeId: "teacher", assignmentRole: "PRIMARY" as const, effectiveFrom, eligibilityStatus: "VERIFIED" as const, status: "ACTIVE" as const };
  repository.assignTeacher("tenant", "admin", input, "a", true);
  assert.throws(() => repository.assignTeacher("tenant", "admin", input, "a", true), /primary teacher/);
});
test("section incharge is an academic responsibility, not a teaching assignment", () => {
  const repository = new InMemoryFacultyPlanningRepository();
  const responsibility = repository.addResponsibility("tenant", "admin", { employeeId: "teacher", academicYearId: "year", campusId: "campus", responsibilityType: "SECTION_INCHARGE", sectionId: "section", effectiveFrom: new Date(), status: "ACTIVE" });
  assert.equal(responsibility.responsibilityType, "SECTION_INCHARGE");
});
test("workload is calculated across all campuses", () => {
  const summary = calculateWorkload("teacher", [{ employeeId: "teacher", campusId: "a", contactPeriods: 12, weightedUnits: 12 }, { employeeId: "teacher", campusId: "b", contactPeriods: 5, weightedUnits: 7.5 }], { maximumContactPeriodsPerWeek: 16, maximumWeightedUnitsPerWeek: 20 });
  assert.equal(summary.contactPeriods, 17); assert.equal(summary.campusBreakdown.length, 2); assert.equal(summary.exceedsContactLimit, true);
});
test("legacy offering assignment statuses are normalized for the GraphQL enum", () => {
  assert.equal(normalizeOfferingAssignmentStatus("ACTIVE"), "ACTIVE");
  assert.equal(normalizeOfferingAssignmentStatus("CANCELLED"), "CANCELLED");
  assert.equal(normalizeOfferingAssignmentStatus("INACTIVE"), "ENDED");
  assert.equal(normalizeOfferingAssignmentStatus(undefined), "ENDED");
});
