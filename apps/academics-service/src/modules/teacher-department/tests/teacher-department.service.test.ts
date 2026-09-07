import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { InMemoryTeacherMentoringRepository } from "../../teacher-mentoring/teacher-mentoring.repository";
import {
  getTeacherCoordinationWorkspace,
  getTeacherDepartmentWorkspace,
  getTeacherLeadershipWorkspace,
} from "../teacher-department.service";

const tenantId = "tenant-greenfield";
const context = (): RequestContext =>
  ({
    requestId: "request-department",
    path: "graphql:teacherDepartmentWorkspace",
    method: "POST",
    headers: {},
    query: {},
    body: {},
    params: {},
    tenantContext: {
      tenantId,
      source: "jwt-claims",
      resolvedAt: new Date(),
    },
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      user: {
        id: "user-hod",
        email: "hod@greenfield.edu.in",
        role: "HOD",
        source: "jwt-claims",
        permissions: [],
      },
    },
  }) as RequestContext;

const workspace: TeacherWorkloadWorkspace = {
  teacher: {
    id: "employee-hod",
    employeeCode: "EMP-HOD",
    fullName: "Meera Joshi",
    staffType: "TEACHER",
    primaryCampusId: "campus-main",
    campusIds: ["campus-main"],
  },
  academicYear: { id: "year-2026", name: "2026-2027" },
  viewMode: "PUBLISHED",
  weekStartDate: "2026-08-10",
  selectedVersions: [],
  policy: {
    scopeType: "DEFAULT",
    inheritedFrom: "DEFAULT",
    isOverride: false,
    maximumWeeklyPeriods: 30,
    maximumDailyPeriods: 8,
    maximumConsecutivePeriods: 3,
  },
  summary: {
    requiredPeriods: 0,
    scheduledPeriods: 0,
    unscheduledPeriods: 0,
    permanentPeriods: 0,
    actualWeeklyPeriods: 0,
    teachingSessions: 0,
    substitutionPeriods: 0,
    cancelledPeriods: 0,
    maximumWeeklyPeriods: 30,
    remainingCapacity: 30,
    overloadPeriods: 0,
    maximumConsecutivePeriods: 0,
    weightedUnits: 0,
  },
  campusBreakdown: [],
  componentBreakdown: [],
  dailyBreakdown: [],
  assignments: [],
  timetableEntries: [],
  availabilityExceptions: [],
  issues: [],
  responsibilities: [
    {
      id: "responsibility-hod-science",
      responsibilityType: "HOD",
      campusId: "campus-main",
      campusName: "Greenfield Campus",
      academicUnitId: "unit-school",
      programId: "program-science",
      programName: "Science",
      effectiveFrom: "2026-06-01T00:00:00.000Z",
    },
  ],
};

async function dependencies() {
  const planning = new InMemoryPlanningStore();
  const mentoringRepository = new InMemoryTeacherMentoringRepository();
  const insert = (
    collection: Parameters<typeof planning.insert>[0],
    id: string,
    data: Record<string, unknown>,
  ) => planning.insert(collection, tenantId, { _id: id, id, tenantId, ...data });
  await insert("academics_programs", "program-science", {
    campusId: "campus-main",
    academicUnitId: "unit-school",
    name: "Science",
    status: "ACTIVE",
  });
  await insert("academics_programs", "program-commerce", {
    campusId: "campus-main",
    academicUnitId: "unit-school",
    name: "Commerce",
    status: "ACTIVE",
  });
  await insert("academics_classes", "class-eight", {
    campusId: "campus-main",
    programId: "program-science",
    name: "Class 8",
    status: "ACTIVE",
  });
  await insert("academics_classes", "class-commerce", {
    campusId: "campus-main",
    programId: "program-commerce",
    name: "Class 11 Commerce",
    status: "ACTIVE",
  });
  await insert("academics_sections", "section-eight-a", {
    campusId: "campus-main",
    classId: "class-eight",
    name: "Section A",
    status: "ACTIVE",
  });
  await insert("subject_catalogue", "catalogue-math", { name: "Mathematics", status: "ACTIVE" });
  await insert("curriculum_subjects", "curriculum-math", {
    subjectCatalogueId: "catalogue-math",
    status: "ACTIVE",
  });
  await insert("subject_components", "component-math", {
    curriculumSubjectId: "curriculum-math",
    status: "ACTIVE",
  });
  await insert("subject_offerings", "offering-math", {
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    subjectComponentId: "component-math",
    requiredPeriodsPerWeek: 5,
    status: "ACTIVE",
  });
  await insert("teaching_assignments_v2", "assignment-math", {
    subjectOfferingId: "offering-math",
    employeeId: "employee-ananya",
    workloadSharePercentage: 100,
    status: "ACTIVE",
  });
  await insert("timetable_period_sets", "period-set-eight", {
    campusId: "campus-main",
    applicableDays: ["MONDAY", "TUESDAY"],
    status: "ACTIVE",
  });
  await insert("timetable_period_slots", "slot-one", {
    periodSetId: "period-set-eight",
    label: "Period 1",
    startTime: "09:00",
    endTime: "09:45",
    slotType: "TEACHING",
    status: "ACTIVE",
  });
  await insert("timetable_period_slots", "slot-two", {
    periodSetId: "period-set-eight",
    label: "Period 2",
    startTime: "09:45",
    endTime: "10:30",
    slotType: "TEACHING",
    status: "ACTIVE",
  });
  for (const [id, label, startTime, endTime] of [
    ["slot-three", "Period 3", "10:45", "11:30"],
    ["slot-four", "Period 4", "11:30", "12:15"],
    ["slot-five", "Period 5", "12:15", "13:00"],
  ]) {
    await insert("timetable_period_slots", id!, {
      periodSetId: "period-set-eight",
      label,
      startTime,
      endTime,
      slotType: "TEACHING",
      status: "ACTIVE",
    });
  }
  await insert("timetable_versions", "version-eight-a", {
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    periodSetId: "period-set-eight",
    name: "Class 8 A",
    status: "PUBLISHED",
    versionNumber: 1,
  });
  await insert("timetable_entries", "entry-math", {
    timetableVersionId: "version-eight-a",
    subjectOfferingId: "offering-math",
    teachingAssignmentIds: ["assignment-math"],
    periodSlotIds: ["slot-one", "slot-two"],
    sectionId: "section-eight-a",
    dayOfWeek: "MONDAY",
    status: "ACTIVE",
  });
  await insert("attendance_sessions", "attendance-eight-a", {
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    date: "2026-08-15",
    status: "SUBMITTED",
  });
  await mentoringRepository.saveAssignment({
    id: "mentor-assignment-one",
    tenantId,
    academicYearId: "year-2026",
    campusId: "campus-main",
    mentorEmployeeId: "employee-ananya",
    studentId: "student-one",
    effectiveFrom: "2026-06-01T00:00:00.000Z",
    status: "ACTIVE",
    version: 1,
    createdBy: "employee-hod",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedBy: "employee-hod",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  return {
    planning,
    mentoringRepository,
    workspaceReader: async () => workspace,
    referenceReader: {
      getEmployee: async () => ({
        _id: "employee-ananya",
        id: "employee-ananya",
        tenantId,
        employeeCode: "EMP-21",
        fullName: "Ananya Rao",
        email: "ananya@greenfield.edu.in",
        phone: "+91 9876543210",
        department: "Science",
        designation: "Teacher",
        status: "ACTIVE",
      }),
      getEmployeeByPrincipal: async () => null,
      getAcademicYear: async () => ({ _id: "year-2026", id: "year-2026", tenantId }),
      listAcademicYears: async () => [],
      listCampuses: async () => [
        {
          _id: "campus-main",
          id: "campus-main",
          tenantId,
          name: "Greenfield Campus",
        },
      ],
    },
    now: () => new Date("2026-08-15T10:00:00.000Z"),
  };
}

test("HOD workspace includes only the assigned program", async () => {
  const result = await getTeacherDepartmentWorkspace({}, context(), await dependencies());
  assert.equal(result.scope.programId, "program-science");
  assert.equal(result.summary.classes, 1);
  assert.equal(result.summary.sections, 1);
  assert.equal(result.summary.faculty, 1);
  assert.equal(result.faculty[0]?.employeeCode, "EMP-21");
  assert.equal(result.faculty[0]?.phone, "+91 9876543210");
  assert.equal(result.faculty[0]?.department, "Science");
  assert.equal(result.faculty[0]?.designation, "Teacher");
  assert.equal(result.faculty[0]?.status, "ACTIVE");
  assert.equal(result.faculty[0]?.menteeCount, 1);
  assert.deepEqual(result.faculty[0]?.allocations, [
    {
      teachingAssignmentId: "assignment-math",
      subjectOfferingId: "offering-math",
      subjectName: "Mathematics",
      className: "Class 8",
      sectionName: "Section A",
      requiredPeriods: 5,
      scheduledPeriods: 2,
    },
  ]);
  assert.deepEqual(
    result.faculty[0]?.schedule.map((lesson) => [
      lesson.dayOfWeek,
      lesson.periodLabel,
      lesson.subjectName,
      lesson.className,
      lesson.sectionName,
    ]),
    [
      ["MONDAY", "Period 1", "Mathematics", "Class 8", "Section A"],
      ["MONDAY", "Period 2", "Mathematics", "Class 8", "Section A"],
    ],
  );
  assert.equal(result.coverage[0]?.subjectName, "Mathematics");
  assert.equal(result.coverage[0]?.scheduledPeriods, 2);
  assert.equal(result.completion[0]?.attendanceStatus, "SUBMITTED");
  assert.equal(result.timetables[0]?.status, "PUBLISHED");
});

test("department timetable summary supports a class version containing section entries", async () => {
  const deps = await dependencies();
  await deps.planning.insert("timetable_versions", tenantId, {
    _id: "version-eight-class",
    id: "version-eight-class",
    tenantId,
    academicYearId: "year-2026",
    academicLevelId: "class-eight",
    scopeType: "ACADEMIC_LEVEL",
    periodSetId: "period-set-eight",
    name: "Class 8",
    status: "PUBLISHED",
    versionNumber: 2,
  });
  await deps.planning.insert("timetable_entries", tenantId, {
    _id: "entry-math-class",
    id: "entry-math-class",
    tenantId,
    timetableVersionId: "version-eight-class",
    sectionId: "section-eight-a",
    subjectOfferingId: "offering-math",
    teachingAssignmentIds: ["assignment-math"],
    periodSlotIds: ["slot-one", "slot-two", "slot-three", "slot-four", "slot-five"],
    status: "ACTIVE",
  });

  const result = await getTeacherDepartmentWorkspace({}, context(), deps);
  assert.equal(result.timetables[0]?.status, "PUBLISHED");
  assert.equal(result.timetables[0]?.entryCount, 1);
  assert.equal(result.coverage[0]?.status, "READY");
  assert.equal(result.summary.publishedTimetables, 1);
});

test("department timetable resolves entry slots when a published version has no period-set link", async () => {
  const deps = await dependencies();
  await deps.planning.insert("timetable_versions", tenantId, {
    _id: "version-eight-without-period-set",
    id: "version-eight-without-period-set",
    tenantId,
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    name: "Class 8 A migrated timetable",
    status: "PUBLISHED",
    versionNumber: 4,
  });
  await deps.planning.insert("timetable_entries", tenantId, {
    _id: "entry-without-period-set",
    id: "entry-without-period-set",
    tenantId,
    timetableVersionId: "version-eight-without-period-set",
    subjectOfferingId: "offering-math",
    teachingAssignmentIds: ["assignment-math"],
    periodSlotIds: ["slot-one"],
    sectionId: "section-eight-a",
    dayOfWeek: "WEDNESDAY",
    status: "ACTIVE",
  });

  const result = await getTeacherDepartmentWorkspace({}, context(), deps);

  assert.deepEqual(
    result.timetables[0]?.slots.map((item) => item.label),
    ["Period 1", "Period 2", "Period 3", "Period 4", "Period 5"],
  );
  assert.deepEqual(result.timetables[0]?.workingDays, ["MONDAY", "TUESDAY", "WEDNESDAY"]);
  assert.equal(result.timetables[0]?.entries[0]?.subjectName, "Mathematics");
  assert.deepEqual(
    result.faculty[0]?.schedule.map((item) => item.periodLabel),
    ["Period 1"],
  );
});

test("HOD workspace does not widen an unscoped responsibility", async () => {
  const deps = await dependencies();
  const unscoped = {
    ...workspace,
    responsibilities: [
      {
        id: "responsibility-hod-unscoped",
        responsibilityType: "HOD",
        campusId: "campus-main",
        campusName: "Greenfield Campus",
        effectiveFrom: "2026-06-01T00:00:00.000Z",
      },
    ],
  };
  await assert.rejects(
    () =>
      getTeacherDepartmentWorkspace({}, context(), {
        ...deps,
        workspaceReader: async () => unscoped,
      }),
    /HOD responsibility with program or academic-unit scope/,
  );
});

test("department schedule contains other teachers' subjects, scoped section entries and real timing", async () => {
  const deps = await dependencies();
  const insert = (
    collection: Parameters<typeof deps.planning.insert>[0],
    id: string,
    data: Record<string, unknown>,
  ) => deps.planning.insert(collection, tenantId, { _id: id, id, tenantId, ...data });
  await insert("timetable_period_sets", "period-set", {
    campusId: "campus-main",
    applicableDays: ["MONDAY", "TUESDAY"],
    status: "ACTIVE",
  });
  await insert("timetable_period_slots", "slot-late", {
    periodSetId: "period-set",
    label: "Period 2",
    startTime: "10:00",
    endTime: "10:45",
    slotType: "TEACHING",
    status: "ACTIVE",
  });
  await insert("timetable_period_slots", "slot-early", {
    periodSetId: "period-set",
    label: "Period 1",
    startTime: "09:00",
    endTime: "09:45",
    slotType: "TEACHING",
    status: "ACTIVE",
  });
  await insert("timetable_versions", "full-version", {
    academicYearId: "year-2026",
    academicLevelId: "class-eight",
    scopeType: "ACADEMIC_LEVEL",
    periodSetId: "period-set",
    name: "Class 8",
    status: "PUBLISHED",
    versionNumber: 3,
  });
  await insert("subject_catalogue", "catalogue-english", { name: "English", status: "ACTIVE" });
  await insert("curriculum_subjects", "curriculum-english", {
    subjectCatalogueId: "catalogue-english",
    status: "ACTIVE",
  });
  await insert("subject_components", "component-english", {
    curriculumSubjectId: "curriculum-english",
    status: "ACTIVE",
  });
  await insert("subject_offerings", "offering-english", {
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    subjectComponentId: "component-english",
    requiredPeriodsPerWeek: 1,
    status: "ACTIVE",
  });
  await insert("teaching_assignments_v2", "assignment-english", {
    subjectOfferingId: "offering-english",
    employeeId: "employee-priya",
    status: "ACTIVE",
  });
  for (const [id, offering, assignment, slot, section] of [
    ["math-full", "offering-math", "assignment-math", "slot-early", "section-eight-a"],
    ["english-full", "offering-english", "assignment-english", "slot-late", "section-eight-a"],
    ["other-section", "offering-english", "assignment-english", "slot-early", "outside-section"],
  ])
    await insert("timetable_entries", id!, {
      timetableVersionId: "full-version",
      subjectOfferingId: offering,
      teachingAssignmentIds: [assignment],
      periodSlotIds: [slot],
      sectionId: section,
      dayOfWeek: "MONDAY",
      status: "ACTIVE",
    });
  const original = deps.referenceReader.getEmployee;
  const result = await getTeacherDepartmentWorkspace({}, context(), {
    ...deps,
    referenceReader: {
      ...deps.referenceReader,
      getEmployee: async (_tenantId, id) =>
        id === "employee-priya"
          ? { ...(await original()), id, fullName: "Priya Nair" }
          : original(),
    },
  });
  const timetable = result.timetables[0]!;
  assert.deepEqual(timetable.workingDays, ["MONDAY", "TUESDAY"]);
  assert.deepEqual(
    timetable.slots.map((item) => item.label),
    ["Period 1", "Period 2"],
  );
  assert.deepEqual(timetable.entries.map((item) => item.subjectName).sort(), [
    "English",
    "Mathematics",
  ]);
  assert.deepEqual(timetable.entries.find((item) => item.subjectName === "English")?.teacherNames, [
    "Priya Nair",
  ]);
  assert.deepEqual(
    timetable.entries.find((item) => item.subjectName === "English")?.teacherEmployeeIds,
    ["employee-priya"],
  );
  assert.equal(timetable.entryCount, 2);
  assert.equal(workspace.timetableEntries.length, 0);
});

test("academic coordinator requires its own scoped responsibility", async () => {
  const deps = await dependencies();
  const coordinatorWorkspace: TeacherWorkloadWorkspace = {
    ...workspace,
    responsibilities: [
      {
        ...workspace.responsibilities[0]!,
        id: "responsibility-coordinator-science",
        responsibilityType: "PROGRAM_COORDINATOR",
      },
    ],
  };
  const result = await getTeacherCoordinationWorkspace({}, context(), {
    ...deps,
    workspaceReader: async () => coordinatorWorkspace,
  });
  assert.equal(result.scope.responsibilityId, "responsibility-coordinator-science");
  await assert.rejects(
    () =>
      getTeacherDepartmentWorkspace({}, context(), {
        ...deps,
        workspaceReader: async () => coordinatorWorkspace,
      }),
    /HOD responsibility/,
  );
});

test("academic leadership is restricted to the employee campus scope", async () => {
  const deps = await dependencies();
  const principalContext = context();
  const principalUser = principalContext.authContext?.user;
  if (!principalUser) throw new Error("test principal auth context is required");
  principalUser.role = "PRINCIPAL";
  const result = await getTeacherLeadershipWorkspace(
    { campusId: "campus-main" },
    principalContext,
    deps,
  );
  assert.equal(result.scope.campusId, "campus-main");
  assert.equal(result.scope.campusName, "Greenfield Campus");
  assert.equal(result.summary.classes, 2);
  await assert.rejects(
    () => getTeacherLeadershipWorkspace({ campusId: "campus-outside" }, principalContext, deps),
    /authorized leadership campus/,
  );
});

test("non-leadership role cannot open the leadership aggregate", async () => {
  const deps = await dependencies();
  await assert.rejects(
    () => getTeacherLeadershipWorkspace({}, context(), deps),
    /academic leadership role is required/,
  );
});
