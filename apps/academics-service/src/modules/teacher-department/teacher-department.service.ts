import type { RequestContext } from "@school-erp/api";
import { BadRequestError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import {
  planningReferenceReader,
  type PlanningReferenceReader,
} from "../planning-store/planning-reference.repository";
import {
  planningStore,
  type PlanningDocument,
  type PlanningStore,
} from "../planning-store/planning-store.repository";
import {
  getTeacherWorkloadWorkspace,
  type TeacherWorkloadDependencies,
} from "../teacher-workload/teacher-workload.service";
import {
  teacherMentoringRepository,
  type TeacherMentoringRepository,
} from "../teacher-mentoring/teacher-mentoring.repository";
import type {
  DepartmentCoverageView,
  DepartmentIssueView,
  TeacherDepartmentWorkspace,
} from "./teacher-department.model";
import { validateTeacherDepartmentInput } from "./teacher-department.validator";

export interface TeacherDepartmentDependencies extends TeacherWorkloadDependencies {
  planning?: PlanningStore;
  referenceReader?: PlanningReferenceReader;
  mentoringRepository?: TeacherMentoringRepository;
  workspaceReader?: typeof getTeacherWorkloadWorkspace;
  now?: () => Date;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const tenant = (context: RequestContext) => {
  const tenantId = context.tenantContext?.tenantId?.trim();
  if (!tenantId) throw new BadRequestError("tenantId is required");
  return tenantId;
};
const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const storeFor = (deps: TeacherDepartmentDependencies) =>
  deps.planning ?? deps.store ?? planningStore();
const refsFor = (deps: TeacherDepartmentDependencies) =>
  deps.referenceReader ?? deps.references ?? planningReferenceReader();
type AcademicScope = {
  id: string;
  responsibilityType: string;
  campusId: string;
  campusName: string;
  academicUnitId?: string;
  programId?: string;
  programName?: string;
};

function latestVersion(records: PlanningDocument[]) {
  return [...records].sort(
    (left, right) =>
      (left.status === "PUBLISHED" ? -1 : 1) - (right.status === "PUBLISHED" ? -1 : 1) ||
      number(right.versionNumber) - number(left.versionNumber) ||
      text(right.updatedAt).localeCompare(text(left.updatedAt)),
  )[0];
}

function subjectName(
  offering: PlanningDocument,
  components: PlanningDocument[],
  curricula: PlanningDocument[],
  catalogue: PlanningDocument[],
) {
  const component = components.find((item) => item.id === offering.subjectComponentId);
  const curriculum = curricula.find(
    (item) => item.id === (offering.curriculumSubjectId ?? component?.curriculumSubjectId),
  );
  return (
    text(catalogue.find((item) => item.id === curriculum?.subjectCatalogueId)?.name) ||
    text(offering.subjectName) ||
    "Subject"
  );
}

async function getTeacherAcademicScopeWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherDepartmentDependencies,
  responsibilityType: "HOD" | "PROGRAM_COORDINATOR" | "LEADERSHIP",
): Promise<TeacherDepartmentWorkspace> {
  const input = validateTeacherDepartmentInput(value);
  const workspace = await (deps.workspaceReader ?? getTeacherWorkloadWorkspace)(
    {
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
      viewMode: "PUBLISHED",
    },
    context,
    deps,
  );
  const tenantId = tenant(context);
  const planning = storeFor(deps);
  let scopes: AcademicScope[];
  if (responsibilityType === "LEADERSHIP") {
    const role = context.authContext?.user?.role;
    if (!["PRINCIPAL", "DEAN", "VICE_PRINCIPAL"].includes(role ?? "")) {
      throw new ForbiddenError("an academic leadership role is required");
    }
    const campusIds = [
      ...new Set(
        [...workspace.teacher.campusIds, workspace.teacher.primaryCampusId].filter(Boolean),
      ),
    ];
    const references =
      deps.referenceReader ??
      deps.references ??
      (!deps.planning && !deps.store ? refsFor(deps) : undefined);
    const campuses = references
      ? await references.listCampuses(tenantId)
      : await planning.list("settings_campuses", tenantId);
    scopes = campusIds.map((campusId) => ({
      id: `leadership:${campusId}`,
      responsibilityType,
      campusId,
      campusName:
        text(campuses.find((item) => item.id === campusId)?.name) ||
        workspace.campusBreakdown.find((item) => item.campusId === campusId)?.campusName ||
        "Assigned campus",
    }));
  } else {
    scopes = workspace.responsibilities.filter(
      (item) =>
        item.responsibilityType === responsibilityType &&
        Boolean(item.programId || item.academicUnitId),
    );
  }
  const selected =
    responsibilityType === "LEADERSHIP"
      ? input.campusId
        ? scopes.find((item) => item.campusId === input.campusId)
        : scopes[0]
      : input.responsibilityId
        ? scopes.find((item) => item.id === input.responsibilityId)
        : scopes[0];
  if (!selected) {
    throw new NotFoundError(
      responsibilityType === "LEADERSHIP"
        ? "an authorized leadership campus was not found"
        : `an active ${responsibilityType.replaceAll("_", " ")} responsibility with program or academic-unit scope was not found`,
    );
  }

  const date = input.date ?? dateOnly((deps.now ?? (() => new Date()))());
  const [
    programs,
    allClasses,
    allSections,
    subjectBatches,
    offerings,
    assignments,
    components,
    curricula,
    catalogue,
    versions,
    entries,
    attendance,
    marksSheets,
    responsibilities,
    periodSets,
    periodSlots,
  ] = await Promise.all([
    planning.list("academics_programs", tenantId, {
      campusId: selected.campusId,
      status: "ACTIVE",
    }),
    planning.list("academics_classes", tenantId, { campusId: selected.campusId, status: "ACTIVE" }),
    planning.list("academics_sections", tenantId, {
      campusId: selected.campusId,
      status: "ACTIVE",
    }),
    planning.list("subject_batches", tenantId, {
      academicYearId: workspace.academicYear.id,
      status: "ACTIVE",
    }),
    planning.list("subject_offerings", tenantId, {
      academicYearId: workspace.academicYear.id,
      status: "ACTIVE",
    }),
    planning.list("teaching_assignments_v2", tenantId, { status: "ACTIVE" }),
    planning.list("subject_components", tenantId, { status: "ACTIVE" }),
    planning.list("curriculum_subjects", tenantId, { status: "ACTIVE" }),
    planning.list("subject_catalogue", tenantId, { status: "ACTIVE" }),
    planning.list("timetable_versions", tenantId, { academicYearId: workspace.academicYear.id }),
    planning.list("timetable_entries", tenantId, { status: "ACTIVE" }),
    planning.list("attendance_sessions", tenantId, {
      academicYearId: workspace.academicYear.id,
      date,
    }),
    planning.list("marks_sheets", tenantId, { academicYearId: workspace.academicYear.id }),
    planning.list("academic_responsibilities", tenantId, {
      academicYearId: workspace.academicYear.id,
      status: "ACTIVE",
    }),
    planning.list("timetable_period_sets", tenantId, {
      campusId: selected.campusId,
      status: "ACTIVE",
    }),
    planning.list("timetable_period_slots", tenantId, { status: "ACTIVE" }),
  ]);

  const scopedPrograms = programs.filter((program) =>
    selected.programId
      ? program.id === selected.programId
      : selected.academicUnitId
        ? program.academicUnitId === selected.academicUnitId
        : true,
  );
  const programIds = new Set(scopedPrograms.map((item) => text(item.id)));
  const classes = allClasses.filter((item) => programIds.has(text(item.programId)));
  const classIds = new Set(classes.map((item) => text(item.id)));
  const sections = allSections.filter((item) => classIds.has(text(item.classId)));
  const sectionIds = new Set(sections.map((item) => text(item.id)));
  const batchById = new Map(subjectBatches.map((item) => [text(item.id), item]));
  const sectionById = new Map(sections.map((item) => [text(item.id), item]));
  const classById = new Map(classes.map((item) => [text(item.id), item]));

  const scopedOfferings = offerings.filter((offering) => {
    const section = sectionById.get(text(offering.sectionId));
    const batch = batchById.get(text(offering.subjectBatchId));
    const classId = text(section?.classId || batch?.academicLevelId || offering.academicLevelId);
    const programId = text(
      classById.get(classId)?.programId || batch?.programId || offering.programId,
    );
    return classIds.has(classId) && programIds.has(programId);
  });
  const offeringIds = new Set(scopedOfferings.map((item) => text(item.id)));
  const scopedAssignments = assignments.filter((item) =>
    offeringIds.has(text(item.subjectOfferingId)),
  );
  const assignmentsByOffering = new Map<string, PlanningDocument[]>();
  for (const assignment of scopedAssignments) {
    const offeringId = text(assignment.subjectOfferingId);
    assignmentsByOffering.set(offeringId, [
      ...(assignmentsByOffering.get(offeringId) ?? []),
      assignment,
    ]);
  }

  const selectedVersions = sections
    .map((section) =>
      latestVersion(
        versions.filter(
          (version) =>
            (version.sectionId === section.id ||
              (version.scopeType === "ACADEMIC_LEVEL" &&
                version.academicLevelId === section.classId)) &&
            ["PUBLISHED", "DRAFT"].includes(text(version.status)),
        ),
      ),
    )
    .filter((item): item is PlanningDocument => Boolean(item));
  const selectedVersionIds = new Set(selectedVersions.map((item) => text(item.id)));
  const scopedEntries = entries.filter(
    (entry) =>
      selectedVersionIds.has(text(entry.timetableVersionId)) &&
      offeringIds.has(text(entry.subjectOfferingId)) &&
      (!entry.sectionId || sectionIds.has(text(entry.sectionId))),
  );
  const employeeIds = [
    ...new Set(scopedAssignments.map((item) => text(item.employeeId)).filter(Boolean)),
  ];
  const references =
    deps.referenceReader ??
    deps.references ??
    (!deps.planning && !deps.store ? refsFor(deps) : undefined);
  const employees = references?.getEmployees
    ? await references.getEmployees(tenantId, employeeIds)
    : await Promise.all(
        employeeIds.map(async (employeeId) => {
          try {
            if (references) return await references.getEmployee(tenantId, employeeId);
            return await planning.get("identity_employees", tenantId, employeeId);
          } catch {
            return null;
          }
        }),
      );
  const employeeById = new Map(
    employees
      .filter((item): item is PlanningDocument => Boolean(item))
      .map((item) => [text(item.id), item]),
  );
  const selectedVersionById = new Map(selectedVersions.map((item) => [text(item.id), item]));
  const periodSlotById = new Map(periodSlots.map((item) => [text(item.id), item]));
  const assignmentById = new Map(scopedAssignments.map((item) => [text(item.id), item]));
  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const scheduledLessons = scopedEntries
    .flatMap((entry) => {
      const offering = scopedOfferings.find((item) => item.id === entry.subjectOfferingId);
      const section = sectionById.get(text(offering?.sectionId || entry.sectionId));
      const academicClass = classById.get(text(section?.classId));
      const version = selectedVersionById.get(text(entry.timetableVersionId));
      if (!offering || !section || !academicClass || !version) return [];
      const teachingAssignmentIds = list(entry.teachingAssignmentIds).filter((id) =>
        assignmentById.has(id),
      );
      const teacherEmployeeIds = [
        ...new Set(
          teachingAssignmentIds
            .map((id) => text(assignmentById.get(id)?.employeeId))
            .filter(Boolean),
        ),
      ];
      return list(entry.periodSlotIds)
        .map((slotId) => periodSlotById.get(slotId))
        .filter(
          (slot): slot is PlanningDocument =>
            slot !== undefined && text(slot.slotType) === "TEACHING",
        )
        .map((slot) => ({
          id: `${text(entry.id)}:${text(slot.id)}`,
          subjectOfferingId: text(offering.id),
          teachingAssignmentIds,
          teacherEmployeeIds,
          dayOfWeek: text(entry.dayOfWeek),
          startTime: text(slot.startTime),
          endTime: text(slot.endTime),
          periodLabel: text(slot.label),
          subjectName: subjectName(offering, components, curricula, catalogue),
          className: text(academicClass.name) || "Class",
          sectionName: text(section.name) || "Section",
        }));
    })
    .sort(
      (left, right) =>
        dayOrder.indexOf(left.dayOfWeek) - dayOrder.indexOf(right.dayOfWeek) ||
        left.startTime.localeCompare(right.startTime) ||
        left.className.localeCompare(right.className) ||
        left.sectionName.localeCompare(right.sectionName),
    );
  const responsibilityTypes = new Map<string, string[]>();
  for (const item of responsibilities) {
    const employeeId = text(item.employeeId);
    if (!employeeIds.includes(employeeId)) continue;
    responsibilityTypes.set(employeeId, [
      ...new Set(
        [...(responsibilityTypes.get(employeeId) ?? []), text(item.responsibilityType)].filter(
          Boolean,
        ),
      ),
    ]);
  }

  const mentoringRepository =
    deps.mentoringRepository ??
    (!deps.planning && !deps.store ? teacherMentoringRepository() : undefined);
  const mentorAssignments = mentoringRepository
    ? await mentoringRepository.listAssignmentsForMentors(
        tenantId,
        employeeIds,
        workspace.academicYear.id,
      )
    : [];
  const menteeCountByEmployee = new Map<string, number>();
  for (const assignment of mentorAssignments) {
    menteeCountByEmployee.set(
      assignment.mentorEmployeeId,
      (menteeCountByEmployee.get(assignment.mentorEmployeeId) ?? 0) + 1,
    );
  }

  const scheduledForOffering = (offeringId: string) =>
    scheduledLessons.filter((lesson) => lesson.subjectOfferingId === offeringId).length;
  const coverage: DepartmentCoverageView[] = scopedOfferings
    .map((offering) => {
      const scoped = assignmentsByOffering.get(text(offering.id)) ?? [];
      const section = sectionById.get(text(offering.sectionId));
      const batch = batchById.get(text(offering.subjectBatchId));
      const academicClass = classById.get(text(section?.classId || batch?.academicLevelId));
      const requiredPeriods = number(offering.requiredPeriodsPerWeek);
      const scheduledPeriods = scheduledForOffering(text(offering.id));
      const teacherNames = scoped.map(
        (item) => text(employeeById.get(text(item.employeeId))?.fullName) || "Unavailable employee",
      );
      const status: DepartmentCoverageView["status"] = !scoped.length
        ? "UNASSIGNED"
        : scheduledPeriods < requiredPeriods
          ? "INCOMPLETE"
          : "READY";
      return {
        subjectOfferingId: text(offering.id),
        subjectName: subjectName(offering, components, curricula, catalogue),
        className: text(academicClass?.name) || "Class",
        ...(section?.name
          ? { sectionName: text(section.name) }
          : batch?.name
            ? { sectionName: text(batch.name) }
            : {}),
        requiredPeriods,
        scheduledPeriods,
        teacherNames,
        status,
      };
    })
    .sort(
      (left, right) =>
        left.className.localeCompare(right.className) ||
        (left.sectionName ?? "").localeCompare(right.sectionName ?? "") ||
        left.subjectName.localeCompare(right.subjectName),
    );

  const faculty = employeeIds
    .map((employeeId) => {
      const employee = employeeById.get(employeeId);
      const employeeAssignments = scopedAssignments.filter(
        (item) => item.employeeId === employeeId,
      );
      const requiredPeriods = employeeAssignments.reduce((sum, item) => {
        const offering = scopedOfferings.find((record) => record.id === item.subjectOfferingId);
        return (
          sum +
          (number(offering?.requiredPeriodsPerWeek) *
            (number(item.workloadSharePercentage) || 100)) /
            100
        );
      }, 0);
      const employeeSchedule = scheduledLessons.filter((lesson) =>
        lesson.teacherEmployeeIds.includes(employeeId),
      );
      const scheduledPeriods = employeeSchedule.length;
      const allocations = employeeAssignments
        .map((assignment) => {
          const offering = scopedOfferings.find(
            (record) => record.id === assignment.subjectOfferingId,
          );
          const section = sectionById.get(text(offering?.sectionId));
          const batch = batchById.get(text(offering?.subjectBatchId));
          const academicClass = classById.get(text(section?.classId || batch?.academicLevelId));
          const assignmentId = text(assignment.id);
          return {
            teachingAssignmentId: assignmentId,
            subjectOfferingId: text(offering?.id),
            subjectName: offering
              ? subjectName(offering, components, curricula, catalogue)
              : "Unavailable subject",
            className: text(academicClass?.name) || "Class",
            ...(section?.name
              ? { sectionName: text(section.name) }
              : batch?.name
                ? { sectionName: text(batch.name) }
                : {}),
            requiredPeriods:
              (number(offering?.requiredPeriodsPerWeek) *
                (number(assignment.workloadSharePercentage) || 100)) /
              100,
            scheduledPeriods: employeeSchedule.filter((lesson) =>
              lesson.teachingAssignmentIds.includes(assignmentId),
            ).length,
          };
        })
        .sort(
          (left, right) =>
            left.className.localeCompare(right.className) ||
            (left.sectionName ?? "").localeCompare(right.sectionName ?? "") ||
            left.subjectName.localeCompare(right.subjectName),
        );
      return {
        employeeId,
        employeeCode: text(employee?.employeeCode),
        fullName: text(employee?.fullName) || "Unavailable employee",
        ...(employee?.email ? { email: text(employee.email) } : {}),
        ...(employee?.phone ? { phone: text(employee.phone) } : {}),
        ...(employee?.department ? { department: text(employee.department) } : {}),
        ...(employee?.designation ? { designation: text(employee.designation) } : {}),
        ...(employee?.staffType ? { staffType: text(employee.staffType) } : {}),
        ...(employee?.employmentType ? { employmentType: text(employee.employmentType) } : {}),
        ...(employee?.joiningDate ? { joiningDate: text(employee.joiningDate) } : {}),
        status: text(employee?.status) || "UNKNOWN",
        loginStatus: text(employee?.loginStatus) || "NONE",
        assignmentCount: employeeAssignments.length,
        requiredPeriods,
        scheduledPeriods,
        menteeCount: menteeCountByEmployee.get(employeeId) ?? 0,
        responsibilityTypes: responsibilityTypes.get(employeeId) ?? [],
        allocations,
        schedule: employeeSchedule.map(
          ({
            subjectOfferingId: _subjectOfferingId,
            teachingAssignmentIds: _assignmentIds,
            teacherEmployeeIds: _employeeIds,
            ...lesson
          }) => lesson,
        ),
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  const timetables = sections
    .map((section) => {
      const version = latestVersion(
        selectedVersions.filter(
          (item) =>
            item.sectionId === section.id ||
            (item.scopeType === "ACADEMIC_LEVEL" && item.academicLevelId === section.classId),
        ),
      );
      const academicClass = classById.get(text(section.classId));
      const versionEntries = version
        ? scopedEntries.filter(
            (item) =>
              item.timetableVersionId === version.id &&
              (!item.sectionId || item.sectionId === section.id),
          )
        : [];
      const validationIssues = Array.isArray(version?.validationIssues)
        ? (version.validationIssues as Array<Record<string, unknown>>)
        : [];
      const referencedSlotIds = new Set(
        versionEntries.flatMap((entry) => list(entry.periodSlotIds)),
      );
      const versionPeriodSetId = text(version?.periodSetId);
      const inferredPeriodSetId = text(
        periodSlots.find((slot) => referencedSlotIds.has(text(slot.id)))?.periodSetId,
      );
      const periodSet = periodSets.find(
        (item) => text(item.id) === (versionPeriodSetId || inferredPeriodSetId),
      );
      const resolvedPeriodSetId = text(periodSet?.id) || versionPeriodSetId || inferredPeriodSetId;
      const slots = periodSlots
        .filter(
          (item) =>
            referencedSlotIds.has(text(item.id)) ||
            (Boolean(resolvedPeriodSetId) && text(item.periodSetId) === resolvedPeriodSetId),
        )
        .sort(
          (a, b) =>
            number(a.sequence) - number(b.sequence) ||
            text(a.startTime).localeCompare(text(b.startTime)),
        );
      const workingDays = [
        ...new Set([
          ...list(periodSet?.applicableDays),
          ...versionEntries.map((entry) => text(entry.dayOfWeek)).filter(Boolean),
        ]),
      ].sort((left, right) => dayOrder.indexOf(left) - dayOrder.indexOf(right));
      return {
        workingDays,
        slots: slots.map((item) => ({
          id: text(item.id),
          sequence: number(item.sequence),
          label: text(item.label),
          startTime: text(item.startTime),
          endTime: text(item.endTime),
          slotType: text(item.slotType),
          ...(Array.isArray(item.applicableDays) && item.applicableDays.length
            ? { applicableDays: item.applicableDays.map(String) }
            : {}),
        })),
        entries: versionEntries
          .filter((entry) => {
            const offering = scopedOfferings.find((item) => item.id === entry.subjectOfferingId);
            return entry.sectionId === section.id || offering?.sectionId === section.id;
          })
          .map((entry) => ({
            id: text(entry.id),
            dayOfWeek: text(entry.dayOfWeek),
            periodSlotIds: list(entry.periodSlotIds),
            subjectName: subjectName(
              scopedOfferings.find((item) => item.id === entry.subjectOfferingId)!,
              components,
              curricula,
              catalogue,
            ),
            teacherNames: list(entry.teachingAssignmentIds)
              .map((id) => scopedAssignments.find((item) => item.id === id))
              .filter((item): item is PlanningDocument => Boolean(item))
              .map(
                (item) =>
                  text(employeeById.get(text(item.employeeId))?.fullName) || "Unavailable employee",
              ),
            teacherEmployeeIds: list(entry.teachingAssignmentIds)
              .map((id) => scopedAssignments.find((item) => item.id === id))
              .filter((item): item is PlanningDocument => Boolean(item))
              .map((item) => text(item.employeeId)),
          })),
        sectionId: text(section.id),
        className: text(academicClass?.name) || "Class",
        sectionName: text(section.name) || "Section",
        ...(version
          ? {
              versionId: text(version.id),
              versionName: text(version.name) || `Version ${number(version.versionNumber)}`,
            }
          : {}),
        status:
          version?.status === "PUBLISHED"
            ? ("PUBLISHED" as const)
            : version
              ? ("DRAFT" as const)
              : ("NOT_CREATED" as const),
        entryCount: versionEntries.length,
        conflictCount: validationIssues.filter((issue) => issue.severity === "ERROR").length,
      };
    })
    .sort(
      (left, right) =>
        left.className.localeCompare(right.className) ||
        left.sectionName.localeCompare(right.sectionName),
    );

  const completion = sections.map((section) => {
    const academicClass = classById.get(text(section.classId));
    const sectionAttendance = attendance.filter(
      (item) => item.sectionId === section.id && item.status === "SUBMITTED",
    );
    const sectionOfferings = scopedOfferings.filter((item) => item.sectionId === section.id);
    const sectionOfferingIds = new Set(sectionOfferings.map((item) => text(item.id)));
    const submittedMarks = marksSheets.filter(
      (item) =>
        item.sectionId === section.id &&
        item.status === "SUBMITTED" &&
        (!item.subjectOfferingId || sectionOfferingIds.has(text(item.subjectOfferingId))),
    );
    const submittedOfferingIds = new Set(
      submittedMarks.map((item) => text(item.subjectOfferingId)).filter(Boolean),
    );
    return {
      sectionId: text(section.id),
      className: text(academicClass?.name) || "Class",
      sectionName: text(section.name) || "Section",
      attendanceStatus: sectionAttendance.length ? ("SUBMITTED" as const) : ("PENDING" as const),
      submittedAttendanceSessions: sectionAttendance.length,
      marksSubmitted: submittedMarks.length,
      marksPending: Math.max(0, sectionOfferings.length - submittedOfferingIds.size),
    };
  });

  const issues: DepartmentIssueView[] = [
    ...coverage
      .filter((item) => item.status === "UNASSIGNED")
      .map((item) => ({
        code: "UNASSIGNED_OFFERING",
        severity: "ERROR" as const,
        title: `${item.subjectName} has no assigned teacher`,
        scope: [item.className, item.sectionName].filter(Boolean).join(" · "),
        action: "Assign an eligible teacher in Class Setup.",
      })),
    ...coverage
      .filter((item) => item.status === "INCOMPLETE")
      .map((item) => ({
        code: "INCOMPLETE_TIMETABLE_COVERAGE",
        severity: "WARNING" as const,
        title: `${item.subjectName} is not fully scheduled`,
        scope: [item.className, item.sectionName].filter(Boolean).join(" · "),
        action: `Schedule ${Math.max(0, item.requiredPeriods - item.scheduledPeriods)} remaining periods.`,
      })),
    ...timetables
      .filter((item) => item.status !== "PUBLISHED")
      .map((item) => ({
        code: "TIMETABLE_NOT_PUBLISHED",
        severity: "WARNING" as const,
        title: "Section timetable is not published",
        scope: `${item.className} · ${item.sectionName}`,
        action: "Complete validation and publish the section timetable.",
      })),
    ...completion
      .filter((item) => item.attendanceStatus === "PENDING")
      .map((item) => ({
        code: "ATTENDANCE_PENDING",
        severity: "WARNING" as const,
        title: "Attendance is pending",
        scope: `${item.className} · ${item.sectionName}`,
        action: "Ask the assigned teacher to submit today’s attendance.",
      })),
  ];

  return {
    scope: {
      responsibilityId: selected.id,
      campusId: selected.campusId,
      campusName: selected.campusName,
      ...(selected.academicUnitId ? { academicUnitId: selected.academicUnitId } : {}),
      ...(selected.programId ? { programId: selected.programId } : {}),
      ...(selected.programName ? { programName: selected.programName } : {}),
    },
    availableScopes: scopes.map((item) => ({
      responsibilityId: item.id,
      campusId: item.campusId,
      campusName: item.campusName,
      ...(item.academicUnitId ? { academicUnitId: item.academicUnitId } : {}),
      ...(item.programId ? { programId: item.programId } : {}),
      ...(item.programName ? { programName: item.programName } : {}),
    })),
    academicYear: workspace.academicYear,
    date,
    summary: {
      faculty: faculty.length,
      classes: classes.length,
      sections: sections.length,
      subjectOfferings: coverage.length,
      unassignedOfferings: coverage.filter((item) => item.status === "UNASSIGNED").length,
      incompleteAllocations: coverage.filter((item) => item.status !== "READY").length,
      publishedTimetables: timetables.filter((item) => item.status === "PUBLISHED").length,
      pendingAttendanceSections: completion.filter((item) => item.attendanceStatus === "PENDING")
        .length,
      pendingMarksSheets: completion.reduce((sum, item) => sum + item.marksPending, 0),
    },
    faculty,
    coverage,
    timetables,
    completion,
    issues,
  };
}

export function getTeacherDepartmentWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherDepartmentDependencies = {},
) {
  return getTeacherAcademicScopeWorkspace(value, context, deps, "HOD");
}

export function getTeacherCoordinationWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherDepartmentDependencies = {},
) {
  return getTeacherAcademicScopeWorkspace(value, context, deps, "PROGRAM_COORDINATOR");
}

export function getTeacherLeadershipWorkspace(
  value: unknown,
  context: RequestContext,
  deps: TeacherDepartmentDependencies = {},
) {
  return getTeacherAcademicScopeWorkspace(value, context, deps, "LEADERSHIP");
}
