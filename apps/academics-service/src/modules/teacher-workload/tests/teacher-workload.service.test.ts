import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore, type PlanningCollection } from "../../planning-store/planning-store.repository";
import { getTeacherWorkloadWorkspace } from "../teacher-workload.service";

const adminContext = (tenantId = "tenant-one"): RequestContext => ({
  requestId: "request", path: "graphql", method: "POST", headers: {}, query: {}, params: {}, body: {},
  tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
  authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", source: "jwt-claims", permissions: ["academics.faculty-planning.read"] } },
});

const record = (id: string, values: Record<string, unknown> = {}) => ({
  _id: id, id, tenantId: "tenant-one", status: "ACTIVE", version: 1,
  createdAt: new Date("2026-06-01T00:00:00.000Z"), updatedAt: new Date("2026-06-01T00:00:00.000Z"), ...values,
});

async function seedWorkspace() {
  const store = new InMemoryPlanningStore();
  const seed = (collection: PlanningCollection, id: string, values: Record<string, unknown> = {}) => store.insert(collection, "tenant-one", record(id, values));
  await seed("identity_employees", "teacher-one", { employeeCode: "EMP-001", fullName: "Ananya Rao", staffCategory: "TEACHING", staffType: "TEACHER", designation: "Mathematics Teacher", department: "Mathematics", primaryCampusId: "campus-main", campusIds: ["campus-main", "campus-east"], userId: "teacher-user" });
  await seed("settings_academic_years", "year-2026", { name: "2026 - 2027", startDate: "2026-06-01T00:00:00.000Z", endDate: "2027-03-31T00:00:00.000Z" });
  await seed("settings_campuses", "campus-main", { name: "Vijayanagara Campus" });
  await seed("settings_campuses", "campus-east", { name: "Ramanagara Campus" });
  await seed("academics_programs", "program-school", { name: "School" });
  await seed("academics_classes", "class-nine", { name: "Class 9", programId: "program-school", campusId: "campus-main" });
  await seed("academics_classes", "class-ten", { name: "Class 10", programId: "program-school", campusId: "campus-east" });
  await seed("academics_sections", "section-a", { name: "Section A", classId: "class-nine", programId: "program-school", campusId: "campus-main" });
  await seed("academics_sections", "section-b", { name: "Section B", classId: "class-ten", programId: "program-school", campusId: "campus-east" });
  await seed("subject_catalogue", "mathematics", { name: "Mathematics" });
  await seed("subject_catalogue", "science", { name: "Science Practical" });
  await seed("curriculum_subjects", "curriculum-mathematics", { subjectCatalogueId: "mathematics" });
  await seed("curriculum_subjects", "curriculum-science", { subjectCatalogueId: "science" });
  await seed("subject_components", "component-theory", { curriculumSubjectId: "curriculum-mathematics", componentType: "THEORY", workloadMultiplier: 1 });
  await seed("subject_components", "component-practical", { curriculumSubjectId: "curriculum-science", componentType: "PRACTICAL", workloadMultiplier: 1.5 });
  await seed("subject_offerings", "offering-nine", { academicYearId: "year-2026", campusId: "campus-main", sectionId: "section-a", subjectComponentId: "component-theory", subjectName: "Mathematics", requiredPeriodsPerWeek: 3 });
  await seed("subject_offerings", "offering-ten", { academicYearId: "year-2026", campusId: "campus-east", sectionId: "section-b", subjectComponentId: "component-practical", subjectName: "Science Practical", requiredPeriodsPerWeek: 2 });
  await seed("teaching_assignments_v2", "assignment-nine", { employeeId: "teacher-one", subjectOfferingId: "offering-nine", assignmentRole: "PRIMARY", effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("teaching_assignments_v2", "assignment-ten", { employeeId: "teacher-one", subjectOfferingId: "offering-ten", assignmentRole: "PRACTICAL_INSTRUCTOR", effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("employee_campus_assignments", "access-main", { employeeId: "teacher-one", campusId: "campus-main", availableForTeaching: true, effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("employee_campus_assignments", "access-east", { employeeId: "teacher-one", campusId: "campus-east", availableForTeaching: true, effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("timetable_period_sets", "period-set-main", { campusId: "campus-main", academicYearId: "year-2026", applicableDays: ["MONDAY", "TUESDAY"] });
  await seed("timetable_period_sets", "period-set-east", { campusId: "campus-east", academicYearId: "year-2026", applicableDays: ["TUESDAY"] });
  await seed("timetable_period_slots", "main-one", { periodSetId: "period-set-main", sequence: 1, label: "Period 1", startTime: "08:00", endTime: "09:00", slotType: "TEACHING", countsForTeachingWorkload: true });
  await seed("timetable_period_slots", "main-two", { periodSetId: "period-set-main", sequence: 2, label: "Period 2", startTime: "09:00", endTime: "10:00", slotType: "TEACHING", countsForTeachingWorkload: true });
  await seed("timetable_period_slots", "east-one", { periodSetId: "period-set-east", sequence: 1, label: "Period 1", startTime: "10:00", endTime: "11:00", slotType: "TEACHING", countsForTeachingWorkload: true });
  await seed("timetable_period_slots", "east-two", { periodSetId: "period-set-east", sequence: 2, label: "Period 2", startTime: "11:00", endTime: "12:00", slotType: "TEACHING", countsForTeachingWorkload: true });
  await seed("timetable_versions", "published-nine", { academicYearId: "year-2026", campusId: "campus-main", scopeType: "ACADEMIC_LEVEL", academicLevelId: "class-nine", programId: "program-school", periodSetId: "period-set-main", name: "Class 9 Timetable", versionNumber: 1, status: "PUBLISHED" });
  await seed("timetable_versions", "published-ten", { academicYearId: "year-2026", campusId: "campus-east", scopeType: "ACADEMIC_LEVEL", academicLevelId: "class-ten", programId: "program-school", periodSetId: "period-set-east", name: "Class 10 Timetable", versionNumber: 1, status: "PUBLISHED" });
  await seed("timetable_entries", "lesson-nine-one", { timetableVersionId: "published-nine", dayOfWeek: "MONDAY", periodSlotIds: ["main-one"], subjectOfferingId: "offering-nine", sectionId: "section-a", teachingAssignmentIds: ["assignment-nine"], entryType: "REGULAR" });
  await seed("timetable_entries", "lesson-nine-two", { timetableVersionId: "published-nine", dayOfWeek: "MONDAY", periodSlotIds: ["main-two"], subjectOfferingId: "offering-nine", sectionId: "section-a", teachingAssignmentIds: ["assignment-nine"], entryType: "REGULAR" });
  await seed("timetable_entries", "lesson-ten-practical", { timetableVersionId: "published-ten", dayOfWeek: "TUESDAY", periodSlotIds: ["east-one", "east-two"], subjectOfferingId: "offering-ten", sectionId: "section-b", teachingAssignmentIds: ["assignment-ten"], entryType: "PRACTICAL" });
  await seed("teacher_workload_policies", "default-policy", { scopeType: "DEFAULT", maximumContactPeriodsPerWeek: 3, maximumPeriodsPerDay: 1, maximumConsecutivePeriods: 1, componentMultipliers: { THEORY: 1, PRACTICAL: 1.5 }, effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("teacher_availability", "blocked-monday", { employeeId: "teacher-one", academicYearId: "year-2026", campusId: "campus-main", dayOfWeek: "MONDAY", startTime: "08:00", endTime: "09:00", availabilityType: "BLOCKED", effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("teacher_availability", "preferred-tuesday", { employeeId: "teacher-one", academicYearId: "year-2026", campusId: "campus-east", dayOfWeek: "TUESDAY", startTime: "10:00", endTime: "12:00", availabilityType: "PREFERRED", effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("academic_responsibilities", "class-teacher", { employeeId: "teacher-one", academicYearId: "year-2026", campusId: "campus-main", academicLevelId: "class-nine", sectionId: "section-a", responsibilityType: "CLASS_TEACHER", effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  return { store, seed };
}

test("workspace consolidates multiple classes, sections and campuses and keeps responsibilities separate", async () => {
  const { store } = await seedWorkspace();
  const result = await getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026", weekStartDate: "2026-08-03T00:00:00.000Z" }, adminContext(), { store });
  assert.equal(result.assignments.length, 2);
  assert.equal(result.campusBreakdown.length, 2);
  assert.equal(result.summary.requiredPeriods, 5);
  assert.equal(result.summary.scheduledPeriods, 4);
  assert.equal(result.summary.unscheduledPeriods, 1);
  assert.equal(result.summary.teachingSessions, 3);
  assert.equal(result.timetableEntries.find((item) => item.id === "lesson-ten-practical")?.periodCount, 2);
  assert.equal(result.assignments.find((item) => item.id === "assignment-nine")?.subjectName, "Mathematics");
  assert.equal(result.responsibilities[0]?.responsibilityType, "CLASS_TEACHER");
  assert.equal(result.summary.requiredPeriods, result.assignments.reduce((sum, item) => sum + item.requiredPeriods, 0));
});

test("workspace reports weekly, daily, consecutive and blocked-availability issues while preferred time remains soft", async () => {
  const { store } = await seedWorkspace();
  const result = await getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026", weekStartDate: "2026-08-03" }, adminContext(), { store });
  const codes = new Set(result.issues.map((item) => item.code));
  assert.ok(codes.has("REQUIRED_PERIODS_UNSCHEDULED"));
  assert.ok(codes.has("WEEKLY_WORKLOAD_EXCEEDED"));
  assert.ok(codes.has("DAILY_WORKLOAD_EXCEEDED"));
  assert.ok(codes.has("CONSECUTIVE_PERIODS_EXCEEDED"));
  assert.ok(codes.has("BLOCKED_AVAILABILITY"));
  assert.equal(result.issues.some((item) => item.reason.includes("preferred")), false);
});

test("selected-week substitutions add workload and cancellations remove workload without changing required assignment periods", async () => {
  const { store, seed } = await seedWorkspace();
  await seed("teaching_assignments_v2", "other-assignment", { employeeId: "teacher-two", subjectOfferingId: "offering-nine", assignmentRole: "CO_TEACHER", effectiveFrom: new Date("2026-06-01T00:00:00.000Z") });
  await seed("timetable_entries", "other-lesson", { timetableVersionId: "published-nine", dayOfWeek: "WEDNESDAY", periodSlotIds: ["main-one"], subjectOfferingId: "offering-nine", sectionId: "section-a", teachingAssignmentIds: ["other-assignment"], entryType: "REGULAR" });
  await seed("timetable_temporary_overrides", "cancel-one", { academicYearId: "year-2026", date: "2026-08-03", action: "CANCEL", timetableEntryId: "lesson-nine-two" });
  await seed("timetable_temporary_overrides", "substitute-one", { academicYearId: "year-2026", date: "2026-08-05", action: "SUBSTITUTE", timetableEntryId: "other-lesson", substituteEmployeeId: "teacher-one" });
  const result = await getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026", weekStartDate: "2026-08-03" }, adminContext(), { store });
  assert.equal(result.summary.requiredPeriods, 5);
  assert.equal(result.summary.cancelledPeriods, 1);
  assert.equal(result.summary.substitutionPeriods, 1);
  assert.equal(result.summary.actualWeeklyPeriods, result.summary.permanentPeriods);
  assert.ok(result.timetableEntries.some((item) => item.state === "CANCELLED"));
  assert.ok(result.timetableEntries.some((item) => item.state === "SUBSTITUTION"));
});

test("workspace detects same-time and cross-campus travel conflicts", async () => {
  const { store, seed } = await seedWorkspace();
  await seed("timetable_entries", "east-overlap", { timetableVersionId: "published-ten", dayOfWeek: "MONDAY", periodSlotIds: ["east-one"], subjectOfferingId: "offering-ten", sectionId: "section-b", teachingAssignmentIds: ["assignment-ten"], entryType: "REGULAR" });
  await seed("campus_travel_rules", "travel-rule", { sourceCampusId: "campus-main", targetCampusId: "campus-east", minimumTravelMinutes: 90 });
  const result = await getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026", weekStartDate: "2026-08-03" }, adminContext(), { store });
  assert.ok(result.issues.some((item) => item.code === "CROSS_CAMPUS_TRAVEL"));
});

test("latest draft preview replaces the published version only for the matching timetable scope", async () => {
  const { store, seed } = await seedWorkspace();
  await seed("timetable_versions", "draft-nine", { academicYearId: "year-2026", campusId: "campus-main", scopeType: "ACADEMIC_LEVEL", academicLevelId: "class-nine", programId: "program-school", periodSetId: "period-set-main", name: "Class 9 Draft", versionNumber: 2, status: "DRAFT" });
  await seed("timetable_entries", "draft-lesson", { timetableVersionId: "draft-nine", dayOfWeek: "FRIDAY", periodSlotIds: ["main-one"], subjectOfferingId: "offering-nine", sectionId: "section-a", teachingAssignmentIds: ["assignment-nine"], entryType: "REGULAR" });
  const published = await getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026", viewMode: "PUBLISHED" }, adminContext(), { store });
  const draft = await getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026", viewMode: "LATEST_DRAFT" }, adminContext(), { store });
  assert.ok(published.selectedVersions.some((item) => item.id === "published-nine"));
  assert.ok(draft.selectedVersions.some((item) => item.id === "draft-nine" && item.status === "DRAFT"));
  assert.ok(draft.selectedVersions.some((item) => item.id === "published-ten"));
});

test("workspace enforces permission and tenant isolation", async () => {
  const { store } = await seedWorkspace();
  const denied = adminContext(); denied.authContext!.user!.permissions = [];
  await assert.rejects(getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026" }, denied, { store }), /permission/);
  await assert.rejects(getTeacherWorkloadWorkspace({ teacherId: "teacher-one", academicYearId: "year-2026" }, adminContext("tenant-two"), { store }), /not found/);
});
