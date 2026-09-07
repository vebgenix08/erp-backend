import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { InMemoryTeacherEngagementRepository } from "../teacher-engagement.repository";
import {
  closeTeacherAcademicDoubt,
  listTeacherAcademicDoubts,
  listTeacherCoursework,
  listTeacherCourseworkSubmissions,
  replyTeacherAcademicDoubt,
  reviewTeacherCourseworkSubmission,
  saveTeacherCoursework,
  setTeacherCourseworkStatus,
} from "../teacher-engagement.service";

const tenantId = "tenant-greenfield";
const context = (): RequestContext =>
  ({
    requestId: "request-engagement",
    path: "graphql:teacherEngagement",
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
    employeeCode: "EMP-14",
    fullName: "Ananya Rao",
    staffType: "TEACHER",
    primaryCampusId: "campus-main",
    campusIds: ["campus-main"],
  },
  academicYear: { id: "year-2026", name: "2026-2027" },
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
      subjectComponentId: "component-math",
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
const deps = () => ({
  repository: new InMemoryTeacherEngagementRepository(),
  workspaceReader: async () => workspace,
  now: () => new Date("2026-08-15T10:00:00.000Z"),
});

test("coursework follows draft, publish, close and archive lifecycle", async () => {
  const dependencies = deps();
  const draft = await saveTeacherCoursework(
    {
      academicYearId: "year-2026",
      subjectOfferingId: "offering-math-8a",
      title: "Linear equations practice",
      instructions: "Complete the worked problems and show each transformation.",
      assignedDate: "2026-08-15",
      submissionDate: "2026-08-20",
      resourceIds: [],
    },
    context(),
    dependencies,
  );
  assert.equal(draft.status, "DRAFT");
  const published = await setTeacherCourseworkStatus(
    { id: draft.id, expectedVersion: 1, status: "PUBLISHED" },
    context(),
    dependencies,
  );
  const closed = await setTeacherCourseworkStatus(
    { id: draft.id, expectedVersion: 2, status: "CLOSED" },
    context(),
    dependencies,
  );
  const archived = await setTeacherCourseworkStatus(
    { id: draft.id, expectedVersion: 3, status: "ARCHIVED" },
    context(),
    dependencies,
  );
  assert.equal(published.status, "PUBLISHED");
  assert.equal(closed.status, "CLOSED");
  assert.equal(archived.status, "ARCHIVED");
  assert.equal(
    (
      await listTeacherCoursework(
        { academicYearId: "year-2026", page: 1, pageSize: 10 },
        context(),
        dependencies,
      )
    ).total,
    1,
  );
});

test("teacher reviews only submissions assigned to the authenticated employee", async () => {
  const dependencies = deps();
  const timestamp = "2026-08-15T09:30:00.000Z";
  const seeded = await dependencies.repository.saveSubmission({
    id: "submission-aarav",
    tenantId,
    courseworkId: "coursework-linear",
    teacherEmployeeId: "employee-ananya",
    studentId: "student-aarav",
    studentName: "Aarav Sharma",
    rollNumber: "08A-01",
    academicYearId: "year-2026",
    campusId: "campus-main",
    subjectOfferingId: "offering-math-8a",
    sectionId: "section-eight-a",
    subjectName: "Mathematics",
    className: "Class 8",
    sectionName: "Section A",
    responseText: "Attached completed work.",
    fileIds: ["file-answer"],
    status: "SUBMITTED",
    submittedAt: timestamp,
    version: 1,
    createdBy: "student-aarav",
    createdAt: timestamp,
    updatedBy: "student-aarav",
    updatedAt: timestamp,
  });
  const reviewed = await reviewTeacherCourseworkSubmission(
    {
      id: seeded.id,
      expectedVersion: 1,
      status: "REVIEWED",
      feedback: "Method and verification are correct.",
    },
    context(),
    dependencies,
  );
  assert.equal(reviewed.status, "REVIEWED");
  assert.equal(
    (
      await listTeacherCourseworkSubmissions(
        { academicYearId: "year-2026", page: 1, pageSize: 10 },
        context(),
        dependencies,
      )
    ).items[0]?.feedback,
    "Method and verification are correct.",
  );
});

test("teacher can answer and close a scoped academic doubt", async () => {
  const dependencies = deps();
  const timestamp = "2026-08-15T09:30:00.000Z";
  const doubt = await dependencies.repository.saveDoubt({
    id: "doubt-aarav",
    tenantId,
    teacherEmployeeId: "employee-ananya",
    studentId: "student-aarav",
    studentName: "Aarav Sharma",
    academicYearId: "year-2026",
    campusId: "campus-main",
    subjectOfferingId: "offering-math-8a",
    sectionId: "section-eight-a",
    subjectName: "Mathematics",
    className: "Class 8",
    sectionName: "Section A",
    title: "Transposition sign change",
    question: "Why does the sign change when moving a term?",
    fileIds: [],
    status: "OPEN",
    replies: [],
    version: 1,
    createdBy: "student-aarav",
    createdAt: timestamp,
    updatedBy: "student-aarav",
    updatedAt: timestamp,
  });
  const answered = await replyTeacherAcademicDoubt(
    {
      id: doubt.id,
      expectedVersion: 1,
      message: "It is the inverse operation applied to both sides.",
      fileIds: [],
    },
    context(),
    dependencies,
  );
  assert.equal(answered.status, "ANSWERED");
  assert.equal(answered.replies.length, 1);
  assert.equal(
    (await closeTeacherAcademicDoubt({ id: doubt.id, expectedVersion: 2 }, context(), dependencies))
      .status,
    "CLOSED",
  );
  assert.equal(
    (
      await listTeacherAcademicDoubts(
        { academicYearId: "year-2026", page: 1, pageSize: 10 },
        context(),
        dependencies,
      )
    ).total,
    1,
  );
  assert.equal(await dependencies.repository.getDoubt("another-tenant", doubt.id), null);
});
