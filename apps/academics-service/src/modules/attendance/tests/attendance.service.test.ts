import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { InMemoryStudentRepository } from "../../students/students.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { PlanningAttendanceRepository } from "../attendance.repository";
import { getTeacherAttendanceWorkspace, saveTeacherAttendance } from "../attendance.service";

const tenantId = "tenant-attendance";
const date = "2026-08-17";

function context(): RequestContext {
  return {
    requestId: "request-attendance",
    path: "graphql:teacherAttendanceWorkspace",
    method: "POST",
    headers: {},
    query: {},
    body: {},
    params: {},
    tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() },
    authContext: {
      source: "jwt-claims",
      authenticatedAt: new Date(),
      user: {
        id: "cognito-teacher",
        email: "teacher@example.com",
        role: "TEACHER",
        source: "jwt-claims",
        permissions: [],
      },
    },
  } as RequestContext;
}

const workload: TeacherWorkloadWorkspace = {
  teacher: {
    id: "employee-teacher",
    employeeCode: "EMP/000001",
    fullName: "Ananya Rao",
    staffType: "TEACHER",
    primaryCampusId: "campus-main",
    campusIds: ["campus-main"],
  },
  academicYear: { id: "year-2026", name: "2026-2027" },
  viewMode: "PUBLISHED",
  weekStartDate: date,
  selectedVersions: [
    { id: "version-one", name: "Published", status: "PUBLISHED", campusId: "campus-main" },
  ],
  policy: {
    scopeType: "DEFAULT",
    inheritedFrom: "DEFAULT",
    isOverride: false,
    maximumWeeklyPeriods: 30,
    maximumDailyPeriods: 8,
    maximumConsecutivePeriods: 3,
  },
  summary: {
    requiredPeriods: 1,
    scheduledPeriods: 1,
    unscheduledPeriods: 0,
    permanentPeriods: 1,
    actualWeeklyPeriods: 1,
    teachingSessions: 1,
    substitutionPeriods: 0,
    cancelledPeriods: 0,
    maximumWeeklyPeriods: 30,
    remainingCapacity: 29,
    overloadPeriods: 0,
    maximumConsecutivePeriods: 1,
    weightedUnits: 1,
  },
  campusBreakdown: [
    {
      campusId: "campus-main",
      campusName: "Main Campus",
      requiredPeriods: 1,
      scheduledPeriods: 1,
      actualPeriods: 1,
    },
  ],
  componentBreakdown: [
    { componentType: "THEORY", requiredPeriods: 1, scheduledPeriods: 1, weightedUnits: 1 },
  ],
  dailyBreakdown: [
    { dayOfWeek: "MONDAY", scheduledPeriods: 1, actualPeriods: 1, maximumConsecutivePeriods: 1 },
  ],
  assignments: [],
  timetableEntries: [
    {
      id: "lesson-one",
      sourceTimetableEntryId: "entry-one",
      subjectOfferingId: "offering-one",
      sectionId: "section-a",
      dayOfWeek: "MONDAY",
      startTime: "09:00",
      endTime: "09:45",
      periodCount: 1,
      teachingSessionCount: 1,
      campusId: "campus-main",
      campusName: "Main Campus",
      className: "Class 8",
      sectionName: "Section A",
      subjectName: "Mathematics",
      componentType: "THEORY",
      state: "PERMANENT",
      timetableVersionId: "version-one",
      timetableVersionStatus: "PUBLISHED",
    },
  ],
  availabilityExceptions: [],
  responsibilities: [],
  issues: [],
};

async function dependencies() {
  const store = new InMemoryPlanningStore();
  const students = new InMemoryStudentRepository();
  for (const [index, name] of ["Aarav Sharma", "Bhavya Patel"].entries()) {
    await students.createFromAdmission(
      tenantId,
      {
        admissionApplicationId: `application-${index}`,
        admissionNumber: `ADM-${index}`,
        registrationNumber: `REG-${index}`,
        rollNumber: String(index + 1),
        campusId: "campus-main",
        academicYearId: "year-2026",
        classId: "class-eight",
        sectionId: "section-a",
        studentName: name,
        phone: `900000000${index}`,
        parentName: "Parent",
        confirmedBy: "admin",
        confirmedAt: `${date}T00:00:00.000Z`,
      },
      "program-school",
    );
  }
  return {
    store,
    students,
    repository: new PlanningAttendanceRepository(store),
    workspaceReader: async () => structuredClone(workload),
    now: () => new Date(`${date}T10:00:00.000Z`),
  };
}

test("teacher attendance workspace uses the active section roster", async () => {
  const deps = await dependencies();
  const result = await getTeacherAttendanceWorkspace({ date }, context(), deps);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.students.length, 2);
  assert.deepEqual(
    result.students.map((item) => item.status),
    ["PRESENT", "PRESENT"],
  );
});

test("teacher can save a draft, submit it once and cannot overwrite the submission", async () => {
  const deps = await dependencies();
  const draft = await saveTeacherAttendance(
    {
      date,
      lessonId: "lesson-one",
      submit: false,
      students: [{ studentId: "student-not-used", status: "PRESENT" }],
    },
    context(),
    deps,
  ).catch((error: unknown) => error);
  assert.equal((draft as Error).name, "ValidationError");

  const roster = await getTeacherAttendanceWorkspace({ date }, context(), deps);
  const students = roster.students.map((item, index) => ({
    studentId: item.studentId,
    status: index === 0 ? ("ABSENT" as const) : ("PRESENT" as const),
  }));
  const saved = await saveTeacherAttendance(
    { date, lessonId: "lesson-one", submit: false, students },
    context(),
    deps,
  );
  assert.equal(saved.status, "DRAFT");
  assert.equal(saved.version, 1);

  const submitted = await saveTeacherAttendance(
    {
      date,
      lessonId: "lesson-one",
      expectedVersion: 1,
      submit: true,
      students,
    },
    context(),
    deps,
  );
  assert.equal(submitted.status, "SUBMITTED");
  assert.equal(submitted.version, 2);

  await assert.rejects(
    saveTeacherAttendance(
      { date, lessonId: "lesson-one", expectedVersion: 2, submit: false, students },
      context(),
      deps,
    ),
    /submitted attendance is locked/i,
  );
});

test("attendance repository never returns another tenant record", async () => {
  const deps = await dependencies();
  const roster = await getTeacherAttendanceWorkspace({ date }, context(), deps);
  const students = roster.students.map((item) => ({
    studentId: item.studentId,
    status: "PRESENT" as const,
  }));
  await saveTeacherAttendance(
    { date, lessonId: "lesson-one", submit: false, students },
    context(),
    deps,
  );
  assert.equal(
    await deps.repository.findByLesson("another-tenant", "employee-teacher", date, "lesson-one"),
    null,
  );
});
