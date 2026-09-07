import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { InMemoryStudentRepository } from "../../students/students.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { getTeacherClassWorkspace } from "../teacher-classes.service";

const tenantId = "tenant-teacher-class";

const context = (): RequestContext =>
  ({
    requestId: "request-teacher-class",
    path: "graphql:teacherClassWorkspace",
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
        id: "teacher-user",
        email: "ananya.rao@example.com",
        role: "TEACHER",
        source: "jwt-claims",
        permissions: [],
      },
    },
  }) as RequestContext;

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
    requiredPeriods: 5,
    scheduledPeriods: 1,
    unscheduledPeriods: 4,
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
  campusBreakdown: [],
  componentBreakdown: [],
  dailyBreakdown: [],
  assignments: [
    {
      id: "assignment-mathematics",
      campusId: "campus-main",
      campusName: "Main Campus",
      classId: "class-eight",
      className: "Class 8",
      sectionId: "section-a",
      sectionName: "Section A",
      subjectOfferingId: "offering-mathematics",
      subjectComponentId: "component-theory",
      subjectName: "Mathematics",
      componentType: "THEORY",
      assignmentRole: "PRIMARY",
      requiredPeriods: 5,
      scheduledPeriods: 1,
      unscheduledPeriods: 4,
      status: "INCOMPLETE",
    },
  ],
  timetableEntries: [
    {
      id: "lesson-monday",
      sourceTimetableEntryId: "entry-monday",
      subjectOfferingId: "offering-mathematics",
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
      timetableVersionId: "published-one",
      timetableVersionStatus: "PUBLISHED",
    },
  ],
  availabilityExceptions: [],
  responsibilities: [],
  issues: [],
};

async function dependencies() {
  const students = new InMemoryStudentRepository();
  await students.createFromAdmission(
    tenantId,
    {
      admissionApplicationId: "application-one",
      admissionNumber: "ADM/2026/000001",
      registrationNumber: "REG/2026/000001",
      rollNumber: "1",
      campusId: "campus-main",
      academicYearId: "year-2026",
      classId: "class-eight",
      sectionId: "section-a",
      studentName: "Aarav Sharma",
      phone: "9000000001",
      parentName: "Ramesh Sharma",
      confirmedBy: "admin-user",
      confirmedAt: "2026-06-01T00:00:00.000Z",
    },
    "program-school",
  );
  return {
    store: new InMemoryPlanningStore(),
    students,
    workspaceReader: async () => structuredClone(workload),
  };
}

test("teacher class workspace preserves the default service reference-reader path", async () => {
  const students = new InMemoryStudentRepository();
  let receivedStore: unknown = "not-called";
  await getTeacherClassWorkspace(
    { academicYearId: "year-2026", subjectOfferingId: "offering-mathematics" },
    context(),
    {
      students,
      workspaceReader: async (_value, _context, receivedDependencies) => {
        receivedStore = receivedDependencies?.store;
        return structuredClone(workload);
      },
    },
  );
  assert.equal(receivedStore, undefined);
});

test("teacher class workspace returns only the roster and timetable for an assigned offering", async () => {
  const result = await getTeacherClassWorkspace(
    { academicYearId: "year-2026", subjectOfferingId: "offering-mathematics" },
    context(),
    await dependencies(),
  );
  assert.equal(result.assignment.subjectName, "Mathematics");
  assert.equal(result.students.length, 1);
  assert.equal(result.students[0]?.studentName, "Aarav Sharma");
  assert.equal(result.timetableEntries.length, 1);
});

test("teacher class workspace rejects an offering outside the authenticated assignment scope", async () => {
  await assert.rejects(
    getTeacherClassWorkspace(
      { subjectOfferingId: "offering-science" },
      context(),
      await dependencies(),
    ),
    /assigned class and subject were not found/i,
  );
});
