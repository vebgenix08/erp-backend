import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { InMemoryTeacherContentRepository } from "../teacher-content.repository";
import {
  archiveTeacherResource,
  listTeacherDiaryEntries,
  listTeacherLessonPlans,
  listTeacherResources,
  saveTeacherDiaryEntry,
  saveTeacherLessonPlan,
  saveTeacherResource,
  setTeacherDiaryStatus,
  setTeacherLessonPlanStatus,
} from "../teacher-content.service";

const tenantId = "tenant-greenfield";
const context = (): RequestContext =>
  ({
    requestId: "request-teacher-content",
    path: "graphql:teacherContent",
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
  }) as RequestContext;

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
  timetableEntries: [],
  availabilityExceptions: [],
  responsibilities: [],
  issues: [],
  assignments: [
    {
      id: "assignment-math-8a",
      campusId: "campus-main",
      campusName: "Greenfield Main Campus",
      classId: "class-eight",
      className: "Class 8",
      sectionId: "section-eight-a",
      sectionName: "Section A",
      subjectOfferingId: "offering-math-8a",
      subjectComponentId: "component-math-theory",
      subjectName: "Mathematics",
      componentType: "THEORY",
      assignmentRole: "SUBJECT_TEACHER",
      requiredPeriods: 5,
      scheduledPeriods: 5,
      unscheduledPeriods: 0,
      status: "COMPLETE",
    },
  ],
};

function dependencies() {
  return {
    repository: new InMemoryTeacherContentRepository(),
    workspaceReader: async () => workspace,
    now: () => new Date("2026-08-15T09:30:00.000Z"),
  };
}

test("lesson plan lifecycle is assignment-scoped and versioned", async () => {
  const deps = dependencies();
  const draft = await saveTeacherLessonPlan(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      planDate: "2026-08-18",
      title: "Linear equations",
      learningObjectives: "Solve one-variable linear equations.",
      topics: "Transposition and verification",
      learningActivities: "Guided examples and paired practice",
      resourceIds: [],
    },
    context(),
    deps,
  );
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.sectionId, "section-eight-a");
  const ready = await setTeacherLessonPlanStatus(
    { id: draft.id, expectedVersion: 1, status: "READY" },
    context(),
    deps,
  );
  assert.equal(ready.status, "READY");
  const completed = await setTeacherLessonPlanStatus(
    { id: ready.id, expectedVersion: 2, status: "COMPLETED" },
    context(),
    deps,
  );
  assert.equal(completed.status, "COMPLETED");
  const result = await listTeacherLessonPlans(
    { academicYearId: "year-2026", page: 1, pageSize: 10 },
    context(),
    deps,
  );
  assert.equal(result.total, 1);
});

test("teaching diary can link only to a lesson plan in the same assignment", async () => {
  const deps = dependencies();
  const plan = await saveTeacherLessonPlan(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      planDate: "2026-08-18",
      title: "Linear equations",
      learningObjectives: "Solve equations.",
      topics: "Transposition",
      resourceIds: [],
    },
    context(),
    deps,
  );
  const diary = await saveTeacherDiaryEntry(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      entryDate: "2026-08-18",
      topic: "Linear equations",
      summary: "Completed guided examples and independent practice.",
      lessonPlanId: plan.id,
    },
    context(),
    deps,
  );
  const recorded = await setTeacherDiaryStatus(
    { id: diary.id, expectedVersion: 1, status: "RECORDED" },
    context(),
    deps,
  );
  assert.equal(recorded.status, "RECORDED");
  const result = await listTeacherDiaryEntries(
    { academicYearId: "year-2026", page: 1, pageSize: 10 },
    context(),
    deps,
  );
  assert.equal(result.items[0]?.lessonPlanId, plan.id);
});

test("file and link resources validate their target and archive safely", async () => {
  const deps = dependencies();
  const file = await saveTeacherResource(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      title: "Linear equations worksheet",
      resourceType: "FILE",
      fileId: "file-worksheet",
      fileName: "linear-equations.pdf",
      contentType: "application/pdf",
    },
    context(),
    deps,
  );
  const link = await saveTeacherResource(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      title: "Interactive practice",
      resourceType: "LINK",
      externalUrl: "https://example.edu/practice",
    },
    context(),
    deps,
  );
  assert.equal(
    (
      await listTeacherResources(
        { academicYearId: "year-2026", page: 1, pageSize: 10 },
        context(),
        deps,
      )
    ).total,
    2,
  );
  assert.equal(
    (await archiveTeacherResource({ id: file.id, expectedVersion: file.version }, context(), deps))
      .status,
    "ARCHIVED",
  );
  await assert.rejects(
    saveTeacherResource(
      {
        academicYearId: "year-2026",
        subjectOfferingId: "offering-math-8a",
        title: "Broken link",
        resourceType: "LINK",
        externalUrl: "javascript:alert(1)",
      },
      context(),
      deps,
    ),
    /validation failed/i,
  );
  assert.equal(link.status, "ACTIVE");
});

test("teacher content rejects unassigned offerings and isolates tenants", async () => {
  const deps = dependencies();
  await assert.rejects(
    saveTeacherLessonPlan(
      {
        academicYearId: "year-2026",
        subjectOfferingId: "offering-science-9b",
        planDate: "2026-08-18",
        title: "Matter",
        learningObjectives: "Classify matter.",
        topics: "States of matter",
        resourceIds: [],
      },
      context(),
      deps,
    ),
    /assigned subject offering was not found/i,
  );
  const resource = await saveTeacherResource(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      title: "Reference",
      resourceType: "LINK",
      externalUrl: "https://example.edu/reference",
    },
    context(),
    deps,
  );
  assert.equal(await deps.repository.getResource("another-tenant", resource.id), null);
});
