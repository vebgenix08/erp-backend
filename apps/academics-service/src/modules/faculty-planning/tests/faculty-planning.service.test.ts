import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { addAcademicResponsibility, addTeacherEligibility, assignEmployeeCampus, assignOfferingTeacher, facultyWorkload } from "../faculty-planning.service";
const ctx: RequestContext = { requestId: "request", path: "graphql", method: "POST", headers: {}, query: {}, params: {}, body: {}, tenantContext: { tenantId: "tenant", source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", source: "jwt-claims", permissions: ["academics.faculty-planning.manage", "academics.faculty-planning.read"] } } };
test("faculty planning persists campus access, verified assignment and workload", async () => {
  const store = new InMemoryPlanningStore();
  await store.insert("curriculum_subjects", "tenant", { _id: "curriculum-subject", id: "curriculum-subject", tenantId: "tenant", subjectCatalogueId: "physics", status: "ACTIVE", version: 1 });
  await store.insert("subject_offerings", "tenant", { _id: "offering", id: "offering", tenantId: "tenant", campusId: "campus", curriculumSubjectId: "curriculum-subject", subjectComponentId: "component", requiredPeriodsPerWeek: 5, effectiveFrom: new Date("2026-06-01"), status: "ACTIVE", version: 1 });
  await store.insert("subject_components", "tenant", { _id: "component", id: "component", tenantId: "tenant", workloadMultiplier: 1.5, status: "ACTIVE", version: 1 });
  await assignEmployeeCampus({ employeeId: "teacher", campusId: "campus", assignmentType: "PRIMARY", availableForTeaching: true, effectiveFrom: "2026-06-01" }, ctx, { store });
  await addTeacherEligibility({ employeeId: "teacher", subjectCatalogueId: "physics", effectiveFrom: "2026-06-01" }, ctx, { store });
  const assignment = await assignOfferingTeacher({ subjectOfferingId: "offering", employeeId: "teacher", assignmentRole: "PRIMARY", effectiveFrom: "2026-06-01" }, ctx, { store });
  const workload = await facultyWorkload("teacher", ctx, { store });
  assert.equal(assignment.eligibilityStatus, "VERIFIED"); assert.equal(workload.contactPeriods, 5); assert.equal(workload.weightedUnits, 7.5);
});
test("teacher eligibility must match the offering catalogue subject", async () => {
  const store = new InMemoryPlanningStore();
  await store.insert("curriculum_subjects", "tenant", { _id: "mathematics-plan", id: "mathematics-plan", tenantId: "tenant", subjectCatalogueId: "mathematics", status: "ACTIVE", version: 1 });
  await store.insert("subject_offerings", "tenant", { _id: "mathematics-offering", id: "mathematics-offering", tenantId: "tenant", campusId: "campus", curriculumSubjectId: "mathematics-plan", effectiveFrom: new Date("2026-06-01"), status: "ACTIVE", version: 1 });
  await assignEmployeeCampus({ employeeId: "teacher", campusId: "campus", assignmentType: "PRIMARY", availableForTeaching: true, effectiveFrom: "2026-06-01" }, ctx, { store });
  await addTeacherEligibility({ employeeId: "teacher", subjectCatalogueId: "physics", effectiveFrom: "2026-06-01" }, ctx, { store });
  await assert.rejects(
    assignOfferingTeacher({ subjectOfferingId: "mathematics-offering", employeeId: "teacher", assignmentRole: "PRIMARY", effectiveFrom: "2026-06-01" }, ctx, { store }),
    /eligibility override reason is required/,
  );
});
test("replacing a primary teacher closes the previous assignment without deleting history", async () => {
  const store = new InMemoryPlanningStore();
  await store.insert("curriculum_subjects", "tenant", { _id: "subject", id: "subject", tenantId: "tenant", subjectCatalogueId: "mathematics", status: "ACTIVE", version: 1 });
  await store.insert("subject_offerings", "tenant", { _id: "offering", id: "offering", tenantId: "tenant", campusId: "campus", curriculumSubjectId: "subject", effectiveFrom: new Date("2026-06-01"), status: "ACTIVE", version: 1 });
  for (const employeeId of ["teacher-one", "teacher-two"]) {
    await assignEmployeeCampus({ employeeId, campusId: "campus", assignmentType: "TEACHING", availableForTeaching: true, effectiveFrom: "2026-06-01" }, ctx, { store });
  }
  const first = await assignOfferingTeacher({ subjectOfferingId: "offering", employeeId: "teacher-one", assignmentRole: "PRIMARY", effectiveFrom: "2026-06-01", eligibilityOverrideReason: "Approved assignment" }, ctx, { store });
  await store.insert("timetable_versions", "tenant", { _id: "draft", id: "draft", tenantId: "tenant", status: "DRAFT", version: 1 });
  await store.insert("timetable_versions", "tenant", { _id: "published", id: "published", tenantId: "tenant", status: "PUBLISHED", version: 1 });
  await store.insert("timetable_entries", "tenant", { _id: "draft-entry", id: "draft-entry", tenantId: "tenant", timetableVersionId: "draft", subjectOfferingId: "offering", teachingAssignmentIds: [first.id], status: "ACTIVE", version: 1 });
  await store.insert("timetable_entries", "tenant", { _id: "published-entry", id: "published-entry", tenantId: "tenant", timetableVersionId: "published", subjectOfferingId: "offering", teachingAssignmentIds: [first.id], status: "ACTIVE", version: 1 });
  const second = await assignOfferingTeacher({ subjectOfferingId: "offering", employeeId: "teacher-two", assignmentRole: "PRIMARY", effectiveFrom: "2026-06-01", eligibilityOverrideReason: "Approved replacement", replaceExistingPrimary: true }, ctx, { store });
  assert.equal((await store.get("teaching_assignments_v2", "tenant", String(first.id)))?.status, "ENDED");
  assert.equal(second.status, "ACTIVE");
  assert.equal(second.employeeId, "teacher-two");
  assert.deepEqual((await store.get("timetable_entries", "tenant", "draft-entry"))?.teachingAssignmentIds, [second.id]);
  assert.deepEqual((await store.get("timetable_entries", "tenant", "published-entry"))?.teachingAssignmentIds, [first.id]);
});
test("replacing a class teacher preserves responsibility history", async () => {
  const store = new InMemoryPlanningStore();
  const first = await addAcademicResponsibility({ employeeId: "teacher-one", academicYearId: "year", campusId: "campus", academicLevelId: "class", sectionId: "section-a", responsibilityType: "CLASS_TEACHER", effectiveFrom: "2026-06-01" }, ctx, { store });
  const second = await addAcademicResponsibility({ employeeId: "teacher-two", academicYearId: "year", campusId: "campus", academicLevelId: "class", sectionId: "section-a", responsibilityType: "CLASS_TEACHER", effectiveFrom: "2026-08-01", replaceExisting: true }, ctx, { store });
  assert.equal((await store.get("academic_responsibilities", "tenant", String(first.id)))?.status, "INACTIVE");
  assert.equal(second.status, "ACTIVE");
  assert.equal(second.employeeId, "teacher-two");
});
