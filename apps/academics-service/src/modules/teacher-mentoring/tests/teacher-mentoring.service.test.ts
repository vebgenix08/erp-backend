import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { NotFoundError } from "@school-erp/errors";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { InMemoryStudentRepository } from "../../students/students.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { InMemoryTeacherMentoringRepository } from "../teacher-mentoring.repository";
import {
  getTeacherMenteeWorkspace,
  listTeacherMentees,
  saveTeacherMentorInteraction,
  setTeacherMentorInteractionStatus,
} from "../teacher-mentoring.service";

const tenantId = "tenant-greenfield";
const context = (userId = "user-ananya"): RequestContext =>
  ({
    requestId: "request-mentoring",
    path: "graphql:teacherMentoring",
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
        id: userId,
        email: `${userId}@greenfield.edu.in`,
        role: "TEACHER",
        source: "jwt-claims",
        permissions: [],
      },
    },
  }) as RequestContext;
const workspace = (employeeId = "employee-ananya"): TeacherWorkloadWorkspace => ({
  teacher: {
    id: employeeId,
    employeeCode: "EMP-14",
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
      id: "responsibility-mentor",
      responsibilityType: "MENTOR",
      campusId: "campus-main",
      campusName: "Greenfield Campus",
      effectiveFrom: "2026-06-01",
    },
  ],
});

async function dependencies() {
  const repository = new InMemoryTeacherMentoringRepository();
  const studentStore = new InMemoryStudentRepository();
  const planning = new InMemoryPlanningStore();
  await studentStore.createFromAdmission(
    tenantId,
    {
      studentId: "student-aarav",
      enrollmentId: "enrollment-aarav",
      admissionApplicationId: "application-aarav",
      admissionNumber: "ADM/2026/0001",
      registrationNumber: "REG/2026/0001",
      rollNumber: "8A-01",
      campusId: "campus-main",
      academicYearId: "year-2026",
      classId: "class-eight",
      sectionId: "section-eight-a",
      studentName: "Aarav Sharma",
      phone: "9000000001",
      parentName: "Ramesh Sharma",
      parentPhone: "9000000002",
      confirmedBy: "admin",
      confirmedAt: "2026-06-01T00:00:00.000Z",
    },
    "program-school",
  );
  await planning.insert("academics_classes", tenantId, {
    _id: "class-eight",
    id: "class-eight",
    tenantId,
    name: "Class 8",
  });
  await planning.insert("academics_sections", tenantId, {
    _id: "section-eight-a",
    id: "section-eight-a",
    tenantId,
    name: "Section A",
  });
  await repository.saveAssignment({
    id: "mentor-assignment-aarav",
    tenantId,
    academicYearId: "year-2026",
    campusId: "campus-main",
    mentorEmployeeId: "employee-ananya",
    studentId: "student-aarav",
    effectiveFrom: "2026-06-01",
    status: "ACTIVE",
    version: 1,
    createdBy: "admin",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedBy: "admin",
    updatedAt: "2026-06-01T00:00:00.000Z",
  });
  return {
    repository,
    students: studentStore,
    planning,
    workspaceReader: async () => workspace(),
    now: () => new Date("2026-08-15T10:00:00.000Z"),
  };
}

test("mentor sees only actively assigned mentees with human-readable academic context", async () => {
  const deps = await dependencies();
  const result = await listTeacherMentees(
    { academicYearId: "year-2026", page: 1, pageSize: 10 },
    context(),
    deps,
  );
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.studentName, "Aarav Sharma");
  assert.equal(result.items[0]?.className, "Class 8");
  assert.equal(result.items[0]?.sectionName, "Section A");
});

test("mentor records, completes and audits a structured interaction", async () => {
  const deps = await dependencies();
  const saved = await saveTeacherMentorInteraction(
    {
      assignmentId: "mentor-assignment-aarav",
      interactionType: "ACADEMIC",
      interactionDate: "2026-08-15",
      summary: "Reviewed mathematics study plan and agreed a daily practice routine.",
      actionItems: ["Complete five practice problems daily"],
      followUpDate: "2026-08-22",
      visibility: "ACADEMIC_TEAM",
    },
    context(),
    deps,
  );
  assert.equal(saved.status, "OPEN");
  const completed = await setTeacherMentorInteractionStatus(
    { id: saved.id, expectedVersion: 1, status: "COMPLETED" },
    context(),
    deps,
  );
  assert.equal(completed.status, "COMPLETED");
  assert.equal(
    (await getTeacherMenteeWorkspace({ assignmentId: "mentor-assignment-aarav" }, context(), deps))
      .interactions.length,
    1,
  );
});

test("a different teacher cannot read or update another mentor assignment", async () => {
  const deps = await dependencies();
  const otherDeps = { ...deps, workspaceReader: async () => workspace("employee-vikram") };
  await assert.rejects(
    () =>
      getTeacherMenteeWorkspace(
        { assignmentId: "mentor-assignment-aarav" },
        context("user-vikram"),
        otherDeps,
      ),
    NotFoundError,
  );
  await assert.rejects(
    () =>
      saveTeacherMentorInteraction(
        {
          assignmentId: "mentor-assignment-aarav",
          interactionType: "GENERAL",
          interactionDate: "2026-08-15",
          summary: "Unauthorized note",
          actionItems: [],
          visibility: "MENTOR_ONLY",
        },
        context("user-vikram"),
        otherDeps,
      ),
    NotFoundError,
  );
});
