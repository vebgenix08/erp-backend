import test from "node:test";
import assert from "node:assert/strict";
import type { RequestContext } from "@school-erp/api";
import { InMemoryPlanningStore } from "../../planning-store/planning-store.repository";
import { InMemoryStudentRepository } from "../../students/students.repository";
import type { TeacherWorkloadWorkspace } from "../../teacher-workload/teacher-workload.model";
import { InMemoryTeacherSectionRepository } from "../teacher-section.repository";
import {
  getTeacherSectionWorkspace,
  resolveTeacherSectionFollowUp,
  saveTeacherSectionFollowUp,
} from "../teacher-section.service";

const tenantId = "tenant-greenfield";
const context = (): RequestContext =>
  ({
    requestId: "request-section",
    path: "graphql:teacherSection",
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
        id: "user-ananya",
        email: "ananya@greenfield.edu.in",
        role: "CLASS_TEACHER",
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
      id: "class-teacher-8a",
      responsibilityType: "CLASS_TEACHER",
      campusId: "campus-main",
      campusName: "Greenfield Campus",
      classId: "class-eight",
      className: "Class 8",
      sectionId: "section-eight-a",
      sectionName: "Section A",
      effectiveFrom: "2026-06-01",
    },
  ],
};

async function dependencies() {
  const repository = new InMemoryTeacherSectionRepository(),
    students = new InMemoryStudentRepository(),
    planning = new InMemoryPlanningStore();
  await students.createFromAdmission(
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
      confirmedBy: "admin",
      confirmedAt: "2026-06-01T00:00:00.000Z",
    },
    "program-school",
  );
  const insert = (
    collection: Parameters<typeof planning.insert>[0],
    id: string,
    data: Record<string, unknown>,
  ) => planning.insert(collection, tenantId, { _id: id, id, tenantId, ...data });
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
    subjectComponentId: "component-math",
    sectionId: "section-eight-a",
    status: "ACTIVE",
  });
  await insert("teaching_assignments_v2", "assignment-math", {
    subjectOfferingId: "offering-math",
    employeeId: "employee-vikram",
    status: "ACTIVE",
  });
  await insert("timetable_period_slots", "slot-one", {
    startTime: "09:00",
    endTime: "09:45",
    status: "ACTIVE",
  });
  await insert("timetable_versions", "version-8a", {
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    status: "PUBLISHED",
    versionNumber: 2,
  });
  await insert("timetable_entries", "entry-math", {
    timetableVersionId: "version-8a",
    dayOfWeek: "MONDAY",
    periodSlotIds: ["slot-one"],
    subjectOfferingId: "offering-math",
    teachingAssignmentIds: ["assignment-math"],
    status: "ACTIVE",
  });
  await insert("attendance_sessions", "attendance-today", {
    academicYearId: "year-2026",
    sectionId: "section-eight-a",
    date: "2026-08-15",
    status: "SUBMITTED",
    students: [{ studentId: "student-aarav", status: "PRESENT" }],
  });
  return {
    repository,
    students,
    planning,
    workspaceReader: async () => workspace,
    referenceReader: {
      getEmployee: async () => ({
        _id: "employee-vikram",
        id: "employee-vikram",
        tenantId,
        fullName: "Vikram Singh",
      }),
      getEmployeeByPrincipal: async () => null,
      getAcademicYear: async () => ({ _id: "year-2026", id: "year-2026", tenantId }),
      listAcademicYears: async () => [],
      listCampuses: async () => [],
    },
    now: () => new Date("2026-08-15T10:00:00.000Z"),
  };
}

test("class teacher workspace returns the whole assigned section roster and timetable", async () => {
  const deps = await dependencies();
  const result = await getTeacherSectionWorkspace(
    { academicYearId: "year-2026", sectionId: "section-eight-a", date: "2026-08-15" },
    context(),
    deps,
  );
  assert.equal(result.section.name, "Section A");
  assert.equal(result.summary.totalStudents, 1);
  assert.equal(result.summary.presentToday, 1);
  assert.equal(result.timetable[0]?.subjectName, "Mathematics");
  assert.equal(result.timetable[0]?.teacherName, "Vikram Singh");
});

test("class teacher follow-up is section scoped, versioned and resolvable", async () => {
  const deps = await dependencies();
  const saved = await saveTeacherSectionFollowUp(
    {
      academicYearId: "year-2026",
      sectionId: "section-eight-a",
      studentId: "student-aarav",
      followUpType: "ACADEMIC",
      summary: "Review homework completion pattern.",
      nextAction: "Meet the student after class.",
      followUpDate: "2026-08-20",
      visibility: "ACADEMIC_TEAM",
    },
    context(),
    deps,
  );
  assert.equal(saved.status, "OPEN");
  const resolved = await resolveTeacherSectionFollowUp(
    { id: saved.id, expectedVersion: 1 },
    context(),
    deps,
  );
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(
    (
      await getTeacherSectionWorkspace(
        { academicYearId: "year-2026", date: "2026-08-15" },
        context(),
        deps,
      )
    ).summary.openFollowUps,
    0,
  );
});
