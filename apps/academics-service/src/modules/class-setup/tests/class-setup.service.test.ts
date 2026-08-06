import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { InMemoryProgramRepository } from "../../programs/programs.repository";
import { getClassSetupWorkspace, removeClassSetupSubject, saveClassSetupTiming, updateClassSetupSubject } from "../class-setup.service";

const context: RequestContext = {
  requestId: "request-class-setup",
  path: "graphql",
  method: "POST",
  headers: {},
  query: {},
  params: {},
  body: {},
  tenantContext: { tenantId: "tenant-one", source: "jwt-claims", resolvedAt: new Date() },
  authContext: {
    source: "jwt-claims",
    authenticatedAt: new Date(),
    user: { id: "admin-one", source: "jwt-claims", permissions: ["academics.timetable.read"] },
  },
};
const manageContext: RequestContext = {
  ...context,
  authContext: {
    ...context.authContext!,
    user: { id: "admin-one", source: "jwt-claims", permissions: ["academics.timetable.read", "academics.timetable.manage"] },
  },
};

test("Class Setup isolates sections and timing configuration by class academic unit", async () => {
  const store = new InMemoryPlanningStore();
  const programs = new InMemoryProgramRepository();
  const school = await programs.create("tenant-one", {
    campusId: "campus-one",
    academicUnitId: "school-unit",
    code: "PROG-001",
    name: "School",
  });

  const seed = (collection: Parameters<typeof store.insert>[0], id: string, values: Record<string, unknown>) =>
    store.insert(collection, "tenant-one", {
      _id: id,
      id,
      tenantId: "tenant-one",
      status: "ACTIVE",
      version: 1,
      createdAt: new Date("2026-06-01"),
      updatedAt: new Date("2026-06-01"),
      ...values,
    });

  await seed("academics_classes", "class-one", { campusId: "campus-one", programId: school.id, name: "Class 1" });
  await seed("academics_sections", "section-a", { campusId: "campus-one", programId: school.id, classId: "class-one", name: "Section A" });
  await seed("academics_sections", "other-class-section", { campusId: "campus-one", programId: school.id, classId: "class-two", name: "Section B" });
  await seed("timetable_period_sets", "school-timing", { campusId: "campus-one", academicYearId: "year-one", academicUnitId: "school-unit", name: "School timing", applicableDays: ["MONDAY"] });
  await seed("timetable_period_sets", "college-timing", { campusId: "campus-one", academicYearId: "year-one", academicUnitId: "college-unit", name: "College timing", applicableDays: ["MONDAY"] });
  await seed("timetable_period_slots", "period-one", { periodSetId: "school-timing", sequence: 1, label: "Period 1", startTime: "09:00", endTime: "09:45", slotType: "TEACHING" });

  const result = await getClassSetupWorkspace(
    { campusId: "campus-one", academicYearId: "year-one", classId: "class-one" },
    context,
    { store, programs },
  );

  assert.deepEqual(result.sections.map((item) => item.id), ["section-a"]);
  assert.deepEqual(result.periodSets.map((item) => item.id), ["school-timing"]);
  assert.deepEqual(result.slots.map((item) => item.id), ["period-one"]);
});

test("Class Setup updates and removes an academic-year subject without leaving active delivery records", async () => {
  const store = new InMemoryPlanningStore(), programs = new InMemoryProgramRepository();
  const program = await programs.create("tenant-one", { campusId: "campus-one", academicUnitId: "school-unit", code: "PROG-001", name: "School" });
  const seed = (collection: Parameters<typeof store.insert>[0], id: string, values: Record<string, unknown>) => store.insert(collection, "tenant-one", { _id: id, id, tenantId: "tenant-one", status: "ACTIVE", version: 1, createdAt: new Date("2026-06-01"), updatedAt: new Date("2026-06-01"), ...values });
  await seed("academics_classes", "class-one", { campusId: "campus-one", programId: program.id, name: "Class 1" });
  await seed("academics_sections", "section-a", { campusId: "campus-one", programId: program.id, classId: "class-one", name: "Section A" });
  await seed("academic_year_subject_plans", "plan-one", { campusId: "campus-one", academicYearId: "year-one", academicUnitId: "school-unit", curriculumId: "curriculum-one", programId: program.id, academicLevelId: "class-one", curriculumSubjectId: "curriculum-subject-one", appliesToAllSections: true, componentPlans: [{ subjectComponentId: "component-one", plannedPeriodsPerWeek: 4, preferredSessionLength: 1, isOverride: false }] });
  await seed("subject_offerings", "offering-one", { campusId: "campus-one", academicYearId: "year-one", subjectPlanId: "plan-one", curriculumSubjectId: "curriculum-subject-one", subjectComponentId: "component-one", sectionId: "section-a", requiredPeriodsPerWeek: 4 });
  await seed("teaching_assignments_v2", "assignment-one", { subjectOfferingId: "offering-one", employeeId: "teacher-one", assignmentRole: "PRIMARY" });

  const updated = await updateClassSetupSubject({ campusId: "campus-one", academicYearId: "year-one", classId: "class-one", subjectPlanId: "plan-one", componentPlans: [{ subjectComponentId: "component-one", plannedPeriodsPerWeek: 6 }] }, manageContext, { store, programs });
  assert.equal(updated.subjects[0]?.periodsPerWeek, 6);
  assert.equal((await store.get("subject_offerings", "tenant-one", "offering-one"))?.requiredPeriodsPerWeek, 6);

  const removed = await removeClassSetupSubject({ campusId: "campus-one", academicYearId: "year-one", classId: "class-one", subjectPlanId: "plan-one", reason: "Curriculum revision" }, manageContext, { store, programs });
  assert.equal(removed.subjects.length, 0);
  assert.equal((await store.get("academic_year_subject_plans", "tenant-one", "plan-one"))?.status, "CLOSED");
  assert.equal((await store.get("subject_offerings", "tenant-one", "offering-one"))?.status, "INACTIVE");
  assert.equal((await store.get("teaching_assignments_v2", "tenant-one", "assignment-one"))?.status, "INACTIVE");
});

test("Class Setup saves ordered non-overlapping timings for the class academic unit", async () => {
  const store = new InMemoryPlanningStore(), programs = new InMemoryProgramRepository();
  const program = await programs.create("tenant-one", { campusId: "campus-one", academicUnitId: "school-unit", code: "PROG-001", name: "School" });
  await store.insert("academics_classes", "tenant-one", { _id: "class-one", id: "class-one", tenantId: "tenant-one", campusId: "campus-one", programId: program.id, name: "Class 1", status: "ACTIVE", version: 1, createdAt: new Date(), updatedAt: new Date() });

  const result = await saveClassSetupTiming({ campusId: "campus-one", academicYearId: "year-one", classId: "class-one", name: "School working day", applicableDays: ["MONDAY", "TUESDAY"], effectiveFrom: "2026-06-01T00:00:00.000Z", effectiveUntil: "2027-03-31T00:00:00.000Z", slots: [{ label: "Period 2", startTime: "09:45", endTime: "10:30", slotType: "TEACHING" }, { label: "Period 1", startTime: "09:00", endTime: "09:45", slotType: "TEACHING" }] }, manageContext, { store, programs });

  assert.equal(result.periodSets[0]?.name, "School working day");
  assert.deepEqual(result.slots.map((item) => item.label), ["Period 1", "Period 2"]);
  assert.equal(result.periodSets[0]?.academicUnitId, "school-unit");
});

test("Class Setup exposes the newest active timetable revision instead of preferring a stale draft", async () => {
  const store = new InMemoryPlanningStore(), programs = new InMemoryProgramRepository();
  const program = await programs.create("tenant-one", { campusId: "campus-one", academicUnitId: "school-unit", code: "PROG-001", name: "School" });
  const seed = (collection: Parameters<typeof store.insert>[0], id: string, values: Record<string, unknown>) => store.insert(collection, "tenant-one", { _id: id, id, tenantId: "tenant-one", status: "ACTIVE", version: 1, createdAt: new Date("2026-06-01"), updatedAt: new Date("2026-06-01"), ...values });
  await seed("academics_classes", "class-one", { campusId: "campus-one", programId: program.id, name: "Class 1" });
  await seed("timetable_period_sets", "period-set", { campusId: "campus-one", academicYearId: "year-one", academicUnitId: "school-unit", name: "School timing", applicableDays: ["MONDAY"] });
  await seed("timetable_versions", "old-draft", { campusId: "campus-one", academicYearId: "year-one", academicLevelId: "class-one", periodSetId: "period-set", versionNumber: 1, status: "DRAFT" });
  await seed("timetable_versions", "current-published", { campusId: "campus-one", academicYearId: "year-one", academicLevelId: "class-one", periodSetId: "period-set", versionNumber: 2, status: "PUBLISHED" });

  const result = await getClassSetupWorkspace({ campusId: "campus-one", academicYearId: "year-one", classId: "class-one" }, context, { store, programs });

  assert.equal(result.currentVersion?.id, "current-published");
  assert.equal(result.currentVersion?.status, "PUBLISHED");
});
