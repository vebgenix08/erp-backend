import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { InMemoryDailyStudentUpdateRepository } from "../daily-student-updates.repository";
import {
  archiveTeacherDailyStudentUpdate,
  listTeacherDailyStudentUpdates,
  publishTeacherDailyStudentUpdate,
  saveTeacherDailyStudentUpdate,
} from "../daily-student-updates.service";

const tenantId = "tenant-greenfield";

function context(): RequestContext {
  return {
    requestId: "request-daily-update",
    path: "graphql:teacherDailyStudentUpdates",
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
        id: "cognito-ananya",
        email: "ananya.rao@greenfield.edu.in",
        role: "TEACHER",
        source: "jwt-claims",
        permissions: [],
      },
    },
  } as RequestContext;
}

const workspace: TeacherWorkloadWorkspace = {
  teacher: {
    id: "employee-ananya",
    employeeCode: "EMP/2026/000014",
    fullName: "Ananya Rao",
    staffType: "TEACHER",
    primaryCampusId: "campus-main",
    campusIds: ["campus-main"],
  },
  academicYear: { id: "year-2026", name: "Academic Year 2026-2027" },
  viewMode: "PUBLISHED",
  weekStartDate: "2026-08-10T00:00:00.000Z",
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
      id: "assignment-mathematics-8a",
      campusId: "campus-main",
      campusName: "Greenfield Main Campus",
      classId: "class-eight",
      className: "Class 8",
      sectionId: "section-eight-a",
      sectionName: "Section A",
      subjectOfferingId: "offering-mathematics-8a",
      subjectComponentId: "component-mathematics-theory",
      subjectName: "Mathematics",
      componentType: "THEORY",
      assignmentRole: "SUBJECT_TEACHER",
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

function dependencies() {
  return {
    repository: new InMemoryDailyStudentUpdateRepository(),
    workspaceReader: async () => structuredClone(workspace),
    now: () => new Date("2026-08-15T09:30:00.000Z"),
  };
}

test("teacher saves and lists a daily student update only inside an assigned offering", async () => {
  const deps = dependencies();
  const saved = await saveTeacherDailyStudentUpdate(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-mathematics-8a",
      updateDate: "2026-08-15",
      title: "Algebra practice",
      message: "Complete exercises 1 to 5 before the next Mathematics period.",
    },
    context(),
    deps,
  );
  assert.equal(saved.status, "DRAFT");
  assert.equal(saved.sectionId, "section-eight-a");
  assert.equal(saved.audience, "STUDENTS_AND_PARENTS");

  const page = await listTeacherDailyStudentUpdates({ page: 1, pageSize: 10 }, context(), deps);
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.title, "Algebra practice");

  await assert.rejects(
    saveTeacherDailyStudentUpdate(
      {
        academicYearId: "year-2026",
        subjectOfferingId: "offering-not-assigned",
        updateDate: "2026-08-15",
        title: "Invalid scope",
        message: "This must not be persisted.",
      },
      context(),
      deps,
    ),
    /assigned subject offering was not found/i,
  );
});

test("daily student update follows draft, published and archived lifecycle", async () => {
  const deps = dependencies();
  const draft = await saveTeacherDailyStudentUpdate(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-mathematics-8a",
      updateDate: "2026-08-15",
      title: "Geometry revision",
      message: "Revise triangle congruence examples discussed today.",
    },
    context(),
    deps,
  );
  const published = await publishTeacherDailyStudentUpdate(
    {
      id: draft.id,
      expectedVersion: draft.version,
    },
    context(),
    deps,
  );
  assert.equal(published.status, "PUBLISHED");
  assert.equal(published.version, 2);

  await assert.rejects(
    saveTeacherDailyStudentUpdate(
      {
        id: published.id,
        expectedVersion: published.version,
        academicYearId: "year-2026",
        subjectOfferingId: "offering-mathematics-8a",
        updateDate: "2026-08-15",
        title: "Changed after publish",
        message: "Published records are immutable.",
      },
      context(),
      deps,
    ),
    /only a draft daily update can be edited/i,
  );

  const archived = await archiveTeacherDailyStudentUpdate(
    {
      id: published.id,
      expectedVersion: published.version,
    },
    context(),
    deps,
  );
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(archived.version, 3);
});

test("daily student update repository enforces tenant isolation", async () => {
  const deps = dependencies();
  const draft = await saveTeacherDailyStudentUpdate(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-mathematics-8a",
      updateDate: "2026-08-15",
      title: "Reading reminder",
      message: "Read the worked examples before tomorrow's class.",
    },
    context(),
    deps,
  );
  assert.equal(await deps.repository.get("another-tenant", draft.id), null);
});
