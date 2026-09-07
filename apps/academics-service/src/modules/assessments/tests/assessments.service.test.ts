import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { ValidationError } from "@school-erp/errors";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { InMemoryStudentRepository } from "../../students/students.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { PlanningAssessmentRepository } from "../assessments.repository";
import {
  getTeacherMarksWorkspace,
  saveAssessmentDefinition,
  saveTeacherMarks,
  setAssessmentDefinitionStatus,
} from "../assessments.service";

const tenantId = "tenant-assessments";
const academicYearId = "year-2026";

function context(role: "TENANT_ADMIN" | "TEACHER"): RequestContext {
  return {
    requestId: `request-${role}`,
    path: "graphql:assessment",
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
        id: role === "TEACHER" ? "cognito-teacher" : "tenant-admin",
        email: `${role.toLowerCase()}@example.com`,
        role,
        source: "jwt-claims",
        permissions: role === "TENANT_ADMIN" ? ["academics.assessment.manage"] : [],
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
  academicYear: { id: academicYearId, name: "2026-2027" },
  viewMode: "PUBLISHED",
  weekStartDate: "2026-08-17",
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
    scheduledPeriods: 5,
    unscheduledPeriods: 0,
    permanentPeriods: 5,
    actualWeeklyPeriods: 5,
    teachingSessions: 5,
    substitutionPeriods: 0,
    cancelledPeriods: 0,
    maximumWeeklyPeriods: 30,
    remainingCapacity: 25,
    overloadPeriods: 0,
    maximumConsecutivePeriods: 1,
    weightedUnits: 5,
  },
  campusBreakdown: [],
  componentBreakdown: [],
  dailyBreakdown: [],
  assignments: [
    {
      id: "assignment-one",
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
      scheduledPeriods: 5,
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
        academicYearId,
        classId: "class-eight",
        sectionId: "section-a",
        studentName: name,
        phone: `900000000${index}`,
        parentName: "Parent",
        confirmedBy: "admin",
        confirmedAt: "2026-06-01T00:00:00.000Z",
      },
      "program-school",
    );
  }
  const repository = new PlanningAssessmentRepository(store);
  const deps = {
    store,
    students,
    repository,
    workspaceReader: async () => structuredClone(workload),
    now: () => new Date("2026-08-20T10:00:00.000Z"),
  };
  const draft = await saveAssessmentDefinition(
    {
      campusId: "campus-main",
      academicYearId,
      classId: "class-eight",
      name: "Unit Test 2",
      assessmentDate: "2026-08-20",
      attendanceWindowStart: "2026-08-01",
      attendanceWindowEnd: "2026-08-19",
      maximumMarks: 25,
      sequence: 2,
    },
    context("TENANT_ADMIN"),
    deps,
  );
  const assessment = await setAssessmentDefinitionStatus(
    {
      id: draft.id,
      status: "OPEN",
      expectedVersion: draft.version,
    },
    context("TENANT_ADMIN"),
    deps,
  );
  const roster = await students.list(tenantId, { sectionId: "section-a", status: "ACTIVE" });
  await store.insert("attendance_sessions", tenantId, {
    _id: "attendance-one",
    id: "attendance-one",
    tenantId,
    subjectOfferingId: "offering-mathematics",
    date: "2026-08-10",
    status: "SUBMITTED",
    students: roster.map(({ student }, index) => ({
      studentId: student.id,
      status: index === 0 ? "PRESENT" : "ABSENT",
    })),
    version: 1,
  });
  return { ...deps, assessment, roster };
}

test("teacher marks workspace uses assigned offering, active roster and submitted attendance", async () => {
  const deps = await dependencies();
  const result = await getTeacherMarksWorkspace({ academicYearId }, context("TEACHER"), deps);
  assert.equal(result.selectedOffering?.id, "offering-mathematics");
  assert.equal(result.selectedAssessment?.maximumMarks, 25);
  assert.equal(result.students.length, 2);
  assert.deepEqual(
    result.students.map((student) => student.attendanceHeld),
    [1, 1],
  );
  assert.deepEqual(
    result.students.map((student) => student.attendanceAttended),
    [1, 0],
  );
});

test("marks enforce configured maximum and submitted sheets are immutable", async () => {
  const deps = await dependencies();
  const workspace = await getTeacherMarksWorkspace({ academicYearId }, context("TEACHER"), deps);
  const base = {
    academicYearId,
    subjectOfferingId: workspace.selectedOffering!.id,
    assessmentId: workspace.selectedAssessment!.id,
  };
  const invalid = workspace.students.map((student, index) => ({
    studentId: student.studentId,
    status: "RECORDED" as const,
    marks: index === 0 ? 26 : 20,
  }));
  await assert.rejects(
    saveTeacherMarks({ ...base, submit: false, students: invalid }, context("TEACHER"), deps),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.details.fields.some((field) => field.message.includes("cannot exceed 25")),
  );

  const valid = workspace.students.map((student, index) => ({
    studentId: student.studentId,
    status: index === 0 ? ("RECORDED" as const) : ("ABSENT" as const),
    ...(index === 0 ? { marks: 23 } : {}),
  }));
  const draft = await saveTeacherMarks(
    { ...base, submit: false, students: valid },
    context("TEACHER"),
    deps,
  );
  assert.equal(draft.status, "DRAFT");
  const submitted = await saveTeacherMarks(
    { ...base, expectedVersion: 1, submit: true, students: valid },
    context("TEACHER"),
    deps,
  );
  assert.equal(submitted.status, "SUBMITTED");
  await assert.rejects(
    saveTeacherMarks(
      { ...base, expectedVersion: 2, submit: false, students: valid },
      context("TEACHER"),
      deps,
    ),
    /closed or already submitted/i,
  );
});

test("assessment repository does not return definitions from another tenant", async () => {
  const deps = await dependencies();
  assert.equal((await deps.repository.listDefinitions("another-tenant", academicYearId)).length, 0);
});
