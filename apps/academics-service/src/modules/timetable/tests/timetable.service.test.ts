import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { addTimetableEntry, createPeriodSetRecord, createPeriodSlotRecord, createTimetableConstraint, createTimetableRevision, createTimetableVersion, deactivateTimetableEntry, generateTimetable, publishTimetable, timetableReadiness, updateTimetableEntry, validateTimetable } from "../timetable.service";
const ctx: RequestContext = { requestId: "request", path: "graphql", method: "POST", headers: {}, query: {}, params: {}, body: {}, tenantContext: { tenantId: "tenant", source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: "admin", source: "jwt-claims", permissions: ["academics.timetable.manage", "academics.timetable.read", "academics.timetable.validate", "academics.timetable.publish"] } } };
test("persistent timetable use cases validate a ready offering", async () => {
  const store = new InMemoryPlanningStore(), seed = async (collection: "teaching_groups" | "subject_offerings" | "teaching_assignments_v2" | "employee_campus_assignments" | "teacher_subject_eligibility" | "curriculum_subjects", id: string, values: Record<string, unknown>) => store.insert(collection, "tenant", { _id: id, id, tenantId: "tenant", status: "ACTIVE", version: 1, ...values });
  await seed("teaching_groups", "group", { campusId: "campus", academicYearId: "year", type: "SECTION" });
  await seed("curriculum_subjects", "curriculum-subject", { subjectCatalogueId: "mathematics" });
  await seed("subject_offerings", "offering", { campusId: "campus", academicYearId: "year", curriculumSubjectId: "curriculum-subject", teachingGroupId: "group", requiredPeriodsPerWeek: 1, effectiveFrom: new Date("2026-06-01") });
  await seed("teaching_assignments_v2", "assignment", { subjectOfferingId: "offering", employeeId: "teacher", assignmentRole: "PRIMARY", effectiveFrom: new Date("2026-06-01"), eligibilityStatus: "VERIFIED" });
  await seed("employee_campus_assignments", "campus-access", { employeeId: "teacher", campusId: "campus", availableForTeaching: true, effectiveFrom: new Date("2026-06-01") });
  await seed("teacher_subject_eligibility", "eligibility", { employeeId: "teacher", subjectCatalogueId: "mathematics", effectiveFrom: new Date("2026-06-01") });
  const periodSet = await createPeriodSetRecord({ campusId: "campus", academicYearId: "year", academicUnitId: "school", name: "Regular", applicableDays: ["MONDAY"], effectiveFrom: "2026-06-01" }, ctx, { store });
  const slot = await createPeriodSlotRecord({ periodSetId: periodSet.id, sequence: 1, label: "Period 1", startTime: "09:00", endTime: "09:45", slotType: "TEACHING", countsForTeachingWorkload: true }, ctx, { store });
  const version = await createTimetableVersion({ campusId: "campus", academicYearId: "year", academicUnitId: "school", name: "Regular", scopeType: "ACADEMIC_UNIT", periodSetId: periodSet.id, effectiveFrom: "2026-06-01", generatedBy: "MANUAL" }, ctx, { store });
  await addTimetableEntry({ timetableVersionId: version.id, dayOfWeek: "MONDAY", periodSlotIds: [slot.id], subjectOfferingId: "offering", teachingGroupId: "group", teachingAssignmentIds: ["assignment"], entryType: "REGULAR" }, ctx, { store });
  assert.equal((await timetableReadiness("campus", "year", ctx, { store })).ready, true);
  assert.equal((await validateTimetable(version.id, ctx, { store })).run.status, "PASSED");
});

test("draft writes reject section collisions on create and update", async () => {
  const store = new InMemoryPlanningStore();
  const seed = (collection: Parameters<typeof store.insert>[0], id: string, values: Record<string, unknown>) =>
    store.insert(collection, "tenant", { _id: id, id, tenantId: "tenant", version: 1, status: "ACTIVE", ...values });
  await seed("timetable_versions", "draft", { periodSetId: "period-set", status: "DRAFT" });
  await seed("timetable_period_slots", "slot-1", { periodSetId: "period-set", sequence: 1, slotType: "TEACHING" });
  await seed("timetable_period_slots", "slot-2", { periodSetId: "period-set", sequence: 2, slotType: "TEACHING" });
  await seed("subject_offerings", "offering-a", { sectionId: "section-a" });
  await seed("subject_offerings", "offering-b", { sectionId: "section-a" });
  await seed("teaching_assignments_v2", "assignment-a", { subjectOfferingId: "offering-a", employeeId: "teacher-a" });
  await seed("teaching_assignments_v2", "assignment-b", { subjectOfferingId: "offering-b", employeeId: "teacher-b" });
  const first = await addTimetableEntry({ timetableVersionId: "draft", dayOfWeek: "MONDAY", periodSlotIds: ["slot-1"], subjectOfferingId: "offering-a", teachingAssignmentIds: ["assignment-a"], entryType: "REGULAR" }, ctx, { store });
  const second = await addTimetableEntry({ timetableVersionId: "draft", dayOfWeek: "MONDAY", periodSlotIds: ["slot-2"], subjectOfferingId: "offering-b", teachingAssignmentIds: ["assignment-b"], entryType: "REGULAR" }, ctx, { store });

  await assert.rejects(
    () => addTimetableEntry({ timetableVersionId: "draft", dayOfWeek: "MONDAY", periodSlotIds: ["slot-1"], subjectOfferingId: "offering-b", teachingAssignmentIds: ["assignment-b"], entryType: "REGULAR" }, ctx, { store }),
    /section already has a lesson/,
  );
  await assert.rejects(
    () => updateTimetableEntry(String(second.id), { dayOfWeek: "MONDAY", periodSlotIds: ["slot-1"], subjectOfferingId: "offering-b", teachingAssignmentIds: ["assignment-b"], entryType: "REGULAR" }, ctx, { store }),
    /section already has a lesson/,
  );
  assert.equal((await store.get("timetable_entries", "tenant", String(first.id)))?.status, "ACTIVE");
  assert.deepEqual((await store.get("timetable_entries", "tenant", String(second.id)))?.periodSlotIds, ["slot-2"]);
});

test("saving the same timetable constraint updates one persistent record", async () => {
  const store = new InMemoryPlanningStore();
  const base = {
    academicYearId: "year",
    timetableVersionId: "version",
    scopeType: "CAMPUS",
    scopeId: "campus",
    constraintType: "MAX_PERIODS_PER_DAY",
    severity: "HARD",
    effectiveFrom: "2026-06-01",
  };
  const created = await createTimetableConstraint({ ...base, parameters: { maximum: 7 } }, ctx, { store });
  const updated = await createTimetableConstraint({ ...base, parameters: { maximum: 6 } }, ctx, { store });
  const records = await store.list("timetable_constraints", "tenant", { timetableVersionId: "version" });
  assert.equal(updated.id, created.id);
  assert.equal(updated.version, 2);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0]?.parameters, { maximum: 6 });
});

test("editable revision preserves sections and isolates entry changes", async () => {
  const store = new InMemoryPlanningStore();
  const seed = (collection: Parameters<typeof store.insert>[0], id: string, values: Record<string, unknown>) =>
    store.insert(collection, "tenant", { _id: id, id, tenantId: "tenant", version: 1, status: "ACTIVE", ...values });
  await seed("timetable_versions", "published", { campusId: "campus", academicYearId: "year", academicUnitId: "unit", academicLevelId: "class_1", programId: "program", name: "Class 1", scopeType: "ACADEMIC_LEVEL", periodSetId: "period-set", status: "PUBLISHED", versionNumber: 2, effectiveFrom: new Date("2026-06-01") });
  await seed("timetable_versions", "stale-draft", { campusId: "campus", academicYearId: "year", academicUnitId: "unit", academicLevelId: "class_1", programId: "program", name: "Class 1 old draft", scopeType: "ACADEMIC_LEVEL", periodSetId: "period-set", status: "DRAFT", versionNumber: 1, effectiveFrom: new Date("2026-06-01") });
  await seed("timetable_versions", "section-draft", { campusId: "campus", academicYearId: "year", academicUnitId: "unit", academicLevelId: "class_1", programId: "program", sectionId: "section-b", name: "Section B draft", scopeType: "SECTION", periodSetId: "period-set", status: "DRAFT", versionNumber: 7, effectiveFrom: new Date("2026-06-01") });
  await seed("timetable_period_slots", "slot-1", { periodSetId: "period-set", sequence: 1, label: "Period 1", startTime: "08:30", endTime: "09:15", slotType: "TEACHING" });
  await seed("timetable_period_slots", "slot-2", { periodSetId: "period-set", sequence: 2, label: "Period 2", startTime: "09:15", endTime: "10:00", slotType: "TEACHING" });
  await seed("subject_offerings", "offering-a", { campusId: "campus", academicYearId: "year", sectionId: "section-a" });
  await seed("subject_offerings", "offering-b", { campusId: "campus", academicYearId: "year", sectionId: "section-b" });
  await seed("teaching_assignments_v2", "assignment-a", { subjectOfferingId: "offering-a", employeeId: "teacher-a" });
  await seed("teaching_assignments_v2", "assignment-b", { subjectOfferingId: "offering-b", employeeId: "teacher-b" });
  await seed("timetable_entries", "entry-a", { timetableVersionId: "published", dayOfWeek: "MONDAY", periodSlotIds: ["slot-1"], subjectOfferingId: "offering-a", sectionId: "section-a", teachingAssignmentIds: ["assignment-a"], entryType: "REGULAR" });
  await seed("timetable_entries", "entry-b", { timetableVersionId: "published", dayOfWeek: "MONDAY", periodSlotIds: ["slot-1"], subjectOfferingId: "offering-b", sectionId: "section-b", teachingAssignmentIds: ["assignment-b"], entryType: "REGULAR" });

  const revision = await createTimetableRevision("published", ctx, { store });
  assert.equal(revision.versionNumber, 3);
  assert.equal((await store.get("timetable_versions", "tenant", "stale-draft"))?.status, "ARCHIVED");
  assert.equal((await store.get("timetable_versions", "tenant", "section-draft"))?.status, "DRAFT");
  const cloned = await store.list("timetable_entries", "tenant", { timetableVersionId: revision.id, status: "ACTIVE" });
  assert.equal(cloned.length, 2);
  const sectionA = cloned.find((entry) => entry.sectionId === "section-a")!;
  const sectionB = cloned.find((entry) => entry.sectionId === "section-b")!;
  await updateTimetableEntry(String(sectionA.id), { timetableVersionId: revision.id, dayOfWeek: "TUESDAY", periodSlotIds: ["slot-2"], subjectOfferingId: "offering-a", teachingAssignmentIds: ["assignment-a"], entryType: "REGULAR" }, ctx, { store });
  await deactivateTimetableEntry(String(sectionB.id), ctx, { store });

  assert.equal((await store.get("timetable_entries", "tenant", String(sectionA.id)))?.dayOfWeek, "TUESDAY");
  assert.equal((await store.get("timetable_entries", "tenant", String(sectionB.id)))?.status, "INACTIVE");
  assert.equal((await store.get("timetable_entries", "tenant", "entry-a"))?.dayOfWeek, "MONDAY");
});

test("section timetable is bound to an existing class hierarchy", async () => {
  const store = new InMemoryPlanningStore();
  await store.insert("academics_classes", "tenant", { _id: "class_10", id: "class_10", tenantId: "tenant", campusId: "campus", programId: "secondary", name: "Class 10", status: "ACTIVE", version: 1 });
  await store.insert("academics_sections", "tenant", { _id: "section_a", id: "section_a", tenantId: "tenant", campusId: "campus", programId: "secondary", classId: "class_10", name: "Section A", status: "ACTIVE", version: 1 });
  const periodSet = await createPeriodSetRecord({ campusId: "campus", academicYearId: "year", academicUnitId: "school", name: "Class 10 - Section A", applicableDays: ["MONDAY"], effectiveFrom: "2026-06-01" }, ctx, { store });
  const version = await createTimetableVersion({ campusId: "campus", academicYearId: "year", academicUnitId: "school", name: "Class 10 - Section A", scopeType: "SECTION", programId: "secondary", academicLevelId: "class_10", sectionId: "section_a", periodSetId: periodSet.id, effectiveFrom: "2026-06-01", generatedBy: "MANUAL" }, ctx, { store });
  assert.equal(version.sectionId, "section_a");
  await assert.rejects(
    () => createTimetableVersion({ campusId: "campus", academicYearId: "year", academicUnitId: "school", name: "Wrong section", scopeType: "SECTION", programId: "secondary", academicLevelId: "class_other", sectionId: "section_a", periodSetId: periodSet.id, effectiveFrom: "2026-06-01", generatedBy: "MANUAL" }, ctx, { store }),
    /class was not found/,
  );
});

test("complete section workflow rejects stale validation and preserves other section publications", async () => {
  const store = new InMemoryPlanningStore();
  const seed = async (
    collection:
      | "academics_classes"
      | "academics_sections"
      | "teaching_groups"
      | "curriculum_subjects"
      | "subject_offerings"
      | "teaching_assignments_v2"
      | "employee_campus_assignments"
      | "teacher_subject_eligibility",
    id: string,
    values: Record<string, unknown>,
  ) =>
    store.insert(collection, "tenant", {
      _id: id,
      id,
      tenantId: "tenant",
      status: "ACTIVE",
      version: 1,
      ...values,
    });

  await seed("academics_classes", "class_10", {
    campusId: "campus",
    programId: "secondary",
    name: "Class 10",
  });
  await seed("academics_sections", "section_a", {
    campusId: "campus",
    programId: "secondary",
    classId: "class_10",
    name: "Section A",
  });
  await seed("academics_sections", "section_b", {
    campusId: "campus",
    programId: "secondary",
    classId: "class_10",
    name: "Section B",
  });
  await seed("teaching_groups", "group_a", {
    campusId: "campus",
    academicYearId: "year",
    type: "SECTION",
    homeSectionId: "section_a",
  });
  await seed("teaching_groups", "group_b", {
    campusId: "campus",
    academicYearId: "year",
    type: "SECTION",
    homeSectionId: "section_b",
  });
  await seed("curriculum_subjects", "curriculum_maths", {
    subjectCatalogueId: "mathematics",
  });
  await seed("subject_offerings", "offering_maths", {
    campusId: "campus",
    academicYearId: "year",
    curriculumSubjectId: "curriculum_maths",
    teachingGroupId: "group_a",
    requiredPeriodsPerWeek: 2,
    effectiveFrom: new Date("2026-06-01"),
  });
  await seed("subject_offerings", "offering_unready_section_b", {
    campusId: "campus",
    academicYearId: "year",
    curriculumSubjectId: "curriculum_maths",
    teachingGroupId: "group_b",
    requiredPeriodsPerWeek: 2,
    effectiveFrom: new Date("2026-06-01"),
  });
  await seed("teaching_assignments_v2", "assignment_maths", {
    subjectOfferingId: "offering_maths",
    employeeId: "teacher_maths",
    assignmentRole: "PRIMARY",
    effectiveFrom: new Date("2026-06-01"),
    eligibilityStatus: "VERIFIED",
  });
  await seed("employee_campus_assignments", "access_maths", {
    employeeId: "teacher_maths",
    campusId: "campus",
    availableForTeaching: true,
    effectiveFrom: new Date("2026-06-01"),
  });
  await seed("teacher_subject_eligibility", "eligibility_maths", {
    employeeId: "teacher_maths",
    subjectCatalogueId: "mathematics",
    effectiveFrom: new Date("2026-06-01"),
  });

  const periodSet = await createPeriodSetRecord(
    {
      campusId: "campus",
      academicYearId: "year",
      academicUnitId: "school",
      name: "Class 10",
      description: "Regular weekly timetable",
      instructionType: "Regular",
      preferences: { allowDoublePeriods: false },
      applicableDays: ["MONDAY", "TUESDAY"],
      effectiveFrom: "2026-06-01",
      effectiveUntil: "2027-05-31",
    },
    ctx,
    { store },
  );
  assert.deepEqual(periodSet.preferences, { allowDoublePeriods: false });
  const monday = await createPeriodSlotRecord(
    {
      periodSetId: periodSet.id,
      sequence: 1,
      label: "Period 1",
      startTime: "09:00",
      endTime: "09:45",
      slotType: "TEACHING",
      countsForTeachingWorkload: true,
    },
    ctx,
    { store },
  );
  const tuesday = await createPeriodSlotRecord(
    {
      periodSetId: periodSet.id,
      sequence: 2,
      label: "Period 2",
      startTime: "09:45",
      endTime: "10:30",
      slotType: "TEACHING",
      countsForTeachingWorkload: true,
    },
    ctx,
    { store },
  );
  const version = await createTimetableVersion(
    {
      campusId: "campus",
      academicYearId: "year",
      academicUnitId: "school",
      name: "Class 10 - Section A",
      scopeType: "SECTION",
      programId: "secondary",
      academicLevelId: "class_10",
      sectionId: "section_a",
      periodSetId: periodSet.id,
      effectiveFrom: "2026-06-01",
      effectiveUntil: "2027-05-31",
      generatedBy: "MANUAL",
    },
    ctx,
    { store },
  );
  await addTimetableEntry(
    {
      timetableVersionId: version.id,
      dayOfWeek: "MONDAY",
      periodSlotIds: [monday.id],
      subjectOfferingId: "offering_maths",
      teachingGroupId: "group_a",
      teachingAssignmentIds: ["assignment_maths"],
      entryType: "REGULAR",
    },
    ctx,
    { store },
  );
  const staleRun = (await validateTimetable(version.id, ctx, { store })).run;
  await addTimetableEntry(
    {
      timetableVersionId: version.id,
      dayOfWeek: "TUESDAY",
      periodSlotIds: [tuesday.id],
      subjectOfferingId: "offering_maths",
      teachingGroupId: "group_a",
      teachingAssignmentIds: ["assignment_maths"],
      entryType: "REGULAR",
    },
    ctx,
    { store },
  );
  await assert.rejects(
    () => publishTimetable(version.id, String(staleRun.id), ctx, { store }),
    /changed after validation/,
  );

  await store.insert("timetable_versions", "tenant", {
    _id: "published_section_b",
    id: "published_section_b",
    tenantId: "tenant",
    campusId: "campus",
    academicYearId: "year",
    academicUnitId: "school",
    programId: "secondary",
    academicLevelId: "class_10",
    sectionId: "section_b",
    scopeType: "SECTION",
    periodSetId: periodSet.id,
    name: "Class 10 - Section B",
    versionNumber: 1,
    status: "PUBLISHED",
    version: 1,
  });
  await store.insert("timetable_versions", "tenant", {
    _id: "stale_section_a_draft",
    id: "stale_section_a_draft",
    tenantId: "tenant",
    campusId: "campus",
    academicYearId: "year",
    academicUnitId: "school",
    programId: "secondary",
    academicLevelId: "class_10",
    sectionId: "section_a",
    scopeType: "SECTION",
    periodSetId: periodSet.id,
    name: "Class 10 - Section A old draft",
    versionNumber: 1,
    status: "DRAFT",
    version: 1,
  });
  const currentRun = (await validateTimetable(version.id, ctx, { store })).run;
  const published = await publishTimetable(version.id, String(currentRun.id), ctx, { store });
  assert.equal(published.status, "PUBLISHED");
  assert.equal((await store.get("timetable_versions", "tenant", "published_section_b"))?.status, "PUBLISHED");
  assert.equal((await store.get("timetable_versions", "tenant", "stale_section_a_draft"))?.status, "ARCHIVED");
});

test("automatic generation fills a direct section offering and reports success honestly", async () => {
  const store = new InMemoryPlanningStore();
  const seed = (collection: Parameters<InMemoryPlanningStore["insert"]>[0], id: string, values: Record<string, unknown>) =>
    store.insert(collection, "tenant", { _id: id, id, tenantId: "tenant", status: "ACTIVE", version: 1, ...values });
  await seed("academics_classes", "class_10", { campusId: "campus", programId: "secondary", name: "Class 10" });
  await seed("academics_sections", "section_a", { campusId: "campus", programId: "secondary", classId: "class_10", name: "Section A" });
  await seed("curriculum_subjects", "curriculum_maths", { subjectCatalogueId: "mathematics" });
  await seed("subject_offerings", "offering_maths", { campusId: "campus", academicYearId: "year", curriculumSubjectId: "curriculum_maths", targetType: "SECTION", sectionId: "section_a", requiredPeriodsPerWeek: 2, requiredConsecutiveSlots: 1, effectiveFrom: new Date("2026-06-01") });
  await seed("teaching_assignments_v2", "assignment_maths", { subjectOfferingId: "offering_maths", employeeId: "teacher_maths", assignmentRole: "PRIMARY", effectiveFrom: new Date("2026-06-01"), eligibilityStatus: "VERIFIED" });
  await seed("employee_campus_assignments", "access_maths", { employeeId: "teacher_maths", campusId: "campus", availableForTeaching: true, effectiveFrom: new Date("2026-06-01") });
  await seed("teacher_subject_eligibility", "eligibility_maths", { employeeId: "teacher_maths", subjectCatalogueId: "mathematics", effectiveFrom: new Date("2026-06-01") });
  const periodSet = await createPeriodSetRecord({ campusId: "campus", academicYearId: "year", academicUnitId: "school", name: "Regular", applicableDays: ["MONDAY", "TUESDAY"], effectiveFrom: "2026-06-01" }, ctx, { store });
  const slot = await createPeriodSlotRecord({ periodSetId: periodSet.id, sequence: 1, label: "Period 1", startTime: "09:00", endTime: "09:45", slotType: "TEACHING", countsForTeachingWorkload: true }, ctx, { store });
  await seed("timetable_versions", "abandoned_draft", { campusId: "campus", academicYearId: "year", academicUnitId: "school", scopeType: "ACADEMIC_LEVEL", academicLevelId: "other_class", periodSetId: periodSet.id, status: "DRAFT" });
  await seed("timetable_entries", "abandoned_entry", { timetableVersionId: "abandoned_draft", dayOfWeek: "MONDAY", periodSlotIds: [slot.id], subjectOfferingId: "other_offering", teachingAssignmentIds: ["assignment_maths"] });
  await seed("timetable_versions", "current_published", { campusId: "campus", academicYearId: "year", academicUnitId: "school", programId: "secondary", scopeType: "ACADEMIC_LEVEL", academicLevelId: "class_10", periodSetId: periodSet.id, status: "PUBLISHED" });
  await seed("timetable_entries", "current_published_entry", { timetableVersionId: "current_published", dayOfWeek: "MONDAY", periodSlotIds: [slot.id], subjectOfferingId: "offering_maths", sectionId: "section_a", teachingAssignmentIds: ["assignment_maths"] });
  const version = await createTimetableVersion({ campusId: "campus", academicYearId: "year", academicUnitId: "school", programId: "secondary", academicLevelId: "class_10", name: "Class 10", scopeType: "ACADEMIC_LEVEL", periodSetId: periodSet.id, effectiveFrom: "2026-06-01", generatedBy: "AUTOMATIC" }, ctx, { store });
  const result = await generateTimetable(version.id, ctx, { store });
  assert.equal(result.success, true);
  assert.equal(result.requiredLessons, 2);
  assert.equal(result.placedLessons, 2);
  assert.equal(result.entries.length, 2);
  assert.equal((await validateTimetable(version.id, ctx, { store })).run.status, "PASSED");
});
