import assert from "node:assert/strict";
import test from "node:test";
import type { RequestContext } from "@school-erp/api";
import { PlanningAssessmentRepository } from "../../assessments/assessments.repository";
import { PlanningAttendanceRepository } from "../../attendance/attendance.repository";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { listTeacherAttendanceHistory, listTeacherMarksHistory } from "../teacher-history.service";

const tenantId = "tenant-history";
const context = (): RequestContext =>
  ({
    requestId: "request-history",
    path: "graphql:teacherHistory",
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
        email: "teacher@example.com",
        role: "TEACHER",
        permissions: [],
        source: "jwt-claims",
      },
    },
  }) as RequestContext;

const workspace: TeacherWorkloadWorkspace = {
  teacher: {
    id: "employee-one",
    employeeCode: "EMP/000001",
    fullName: "Ananya Rao",
    staffType: "TEACHER",
    primaryCampusId: "campus-one",
    campusIds: ["campus-one"],
  },
  academicYear: { id: "year-one", name: "2026-2027" },
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
  campusBreakdown: [],
  componentBreakdown: [],
  dailyBreakdown: [],
  assignments: [
    {
      id: "assignment-one",
      campusId: "campus-one",
      campusName: "Main Campus",
      classId: "class-one",
      className: "Class 8",
      sectionId: "section-one",
      sectionName: "Section A",
      subjectOfferingId: "offering-one",
      subjectComponentId: "component-one",
      subjectName: "Mathematics",
      componentType: "THEORY",
      assignmentRole: "PRIMARY",
      requiredPeriods: 1,
      scheduledPeriods: 1,
      unscheduledPeriods: 0,
      status: "COMPLETE",
    },
  ],
  timetableEntries: [],
  availabilityExceptions: [],
  responsibilities: [],
  issues: [],
};

async function dependencies() {
  const store = new InMemoryPlanningStore();
  const attendance = new PlanningAttendanceRepository(store);
  const assessments = new PlanningAssessmentRepository(store);
  await attendance.save({
    id: "attendance-one",
    tenantId,
    employeeId: "employee-one",
    academicYearId: "year-one",
    campusId: "campus-one",
    date: "2026-08-14",
    lessonId: "lesson-one",
    timetableEntryId: "entry-one",
    timetableVersionId: "version-one",
    subjectOfferingId: "offering-one",
    sectionId: "section-one",
    subjectName: "Mathematics",
    className: "Class 8",
    sectionName: "Section A",
    startTime: "09:00",
    endTime: "09:45",
    status: "SUBMITTED",
    students: [
      {
        studentId: "student-one",
        enrollmentId: "enrollment-one",
        studentName: "Aarav Sharma",
        status: "PRESENT",
      },
      {
        studentId: "student-two",
        enrollmentId: "enrollment-two",
        studentName: "Bhavya Patel",
        status: "ABSENT",
      },
    ],
    version: 1,
    createdBy: "teacher-user",
    createdAt: "2026-08-14T09:50:00.000Z",
    updatedBy: "teacher-user",
    updatedAt: "2026-08-14T09:50:00.000Z",
    submittedBy: "teacher-user",
    submittedAt: "2026-08-14T09:50:00.000Z",
  });
  await assessments.saveDefinition({
    id: "assessment-one",
    tenantId,
    campusId: "campus-one",
    academicYearId: "year-one",
    classId: "class-one",
    name: "First Unit Test",
    assessmentDate: "2026-08-15",
    attendanceWindowStart: "2026-07-15",
    attendanceWindowEnd: "2026-08-14",
    maximumMarks: 40,
    sequence: 1,
    status: "OPEN",
    version: 1,
    createdBy: "admin-user",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedBy: "admin-user",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  await assessments.saveSheet({
    id: "marks-one",
    tenantId,
    employeeId: "employee-one",
    academicYearId: "year-one",
    campusId: "campus-one",
    assessmentId: "assessment-one",
    subjectOfferingId: "offering-one",
    subjectName: "Mathematics",
    className: "Class 8",
    sectionName: "Section A",
    sectionId: "section-one",
    status: "SUBMITTED",
    students: [
      {
        studentId: "student-one",
        enrollmentId: "enrollment-one",
        studentName: "Aarav Sharma",
        status: "RECORDED",
        marks: 36,
      },
      {
        studentId: "student-two",
        enrollmentId: "enrollment-two",
        studentName: "Bhavya Patel",
        status: "ABSENT",
      },
    ],
    version: 1,
    createdBy: "teacher-user",
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedBy: "teacher-user",
    updatedAt: "2026-08-15T12:00:00.000Z",
    submittedBy: "teacher-user",
    submittedAt: "2026-08-15T12:00:00.000Z",
  });
  return {
    store,
    attendance,
    assessments,
    workspaceReader: async () => structuredClone(workspace),
  };
}

test("attendance history returns scoped submitted totals", async () => {
  const result = await listTeacherAttendanceHistory(
    { subjectOfferingId: "offering-one", status: "SUBMITTED", page: 1, pageSize: 10 },
    context(),
    await dependencies(),
  );
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.presentCount, 1);
  assert.equal(result.items[0]?.absentCount, 1);
});

test("marks history joins the assessment definition and result totals", async () => {
  const result = await listTeacherMarksHistory(
    { page: 1, pageSize: 10 },
    context(),
    await dependencies(),
  );
  assert.equal(result.items[0]?.assessmentName, "First Unit Test");
  assert.equal(result.items[0]?.maximumMarks, 40);
  assert.equal(result.items[0]?.recordedCount, 1);
  assert.equal(result.items[0]?.absentCount, 1);
});
