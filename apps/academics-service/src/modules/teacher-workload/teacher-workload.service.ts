import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from "@school-erp/errors";
import {
  planningStore,
  type PlanningDocument,
  type PlanningStore,
} from "../planning-store/planning-store.repository";
import type {
  TeacherWorkloadInput,
  TeacherWorkloadWorkspace,
  WorkloadAssignmentView,
  WorkloadIssueView,
  WorkloadLessonView,
  WorkloadPolicyView,
} from "./teacher-workload.model";

export interface TeacherWorkloadDependencies { store?: PlanningStore }

interface CalculationInput {
  teacher: PlanningDocument;
  academicYear: PlanningDocument;
  weekStartDate: string;
  viewMode: "PUBLISHED" | "LATEST_DRAFT";
  selectedVersions: PlanningDocument[];
  entries: PlanningDocument[];
  overrides: PlanningDocument[];
  assignments: PlanningDocument[];
  offerings: PlanningDocument[];
  components: PlanningDocument[];
  curriculumSubjects: PlanningDocument[];
  subjectCatalogue: PlanningDocument[];
  policies: PlanningDocument[];
  availability: PlanningDocument[];
  campusAssignments: PlanningDocument[];
  responsibilities: PlanningDocument[];
  campuses: PlanningDocument[];
  programs: PlanningDocument[];
  classes: PlanningDocument[];
  sections: PlanningDocument[];
  batches: PlanningDocument[];
  slots: PlanningDocument[];
  travelRules: PlanningDocument[];
}

function resolveSubjectName(offering: PlanningDocument, input: CalculationInput) {
  const component = input.components.find((item) => item.id === offering.subjectComponentId);
  const curriculumSubjectId = text(offering.curriculumSubjectId || component?.curriculumSubjectId);
  const curriculumSubject = input.curriculumSubjects.find((item) => item.id === curriculumSubjectId);
  const catalogue = input.subjectCatalogue.find((item) => item.id === curriculumSubject?.subjectCatalogueId);
  return text(catalogue?.name || offering.subjectName) || "Subject";
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const stringList = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : text(value);
const day = (value: unknown) => text(value).trim().toUpperCase();
const timeMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};
const overlapsTime = (leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) =>
  timeMinutes(leftStart) < timeMinutes(rightEnd) && timeMinutes(rightStart) < timeMinutes(leftEnd);
const monday = (value?: string) => {
  const source = value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value) : new Date();
  if (Number.isNaN(source.getTime())) throw new ValidationError([{ field: "weekStartDate", message: "weekStartDate must be a valid date" }]);
  const currentDay = source.getUTCDay();
  source.setUTCDate(source.getUTCDate() - (currentDay === 0 ? 6 : currentDay - 1));
  return source.toISOString().slice(0, 10);
};
const endOfWeek = (weekStart: string) => {
  const result = new Date(`${weekStart}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + 6);
  return result.toISOString().slice(0, 10);
};
const isEffective = (record: PlanningDocument, from: string, until = from) => {
  const recordFrom = iso(record.effectiveFrom || record.createdAt).slice(0, 10) || "0000-01-01";
  const recordUntil = iso(record.effectiveUntil).slice(0, 10) || "9999-12-31";
  return recordFrom <= until && from <= recordUntil;
};
const toDateOnly = (value: unknown) => iso(value).slice(0, 10);
const dateTime = (value: unknown) => {
  const raw = iso(value);
  if (!raw) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : new Date(raw).toISOString();
};
const versionScope = (record: PlanningDocument) => [record.campusId, record.scopeType, record.programId, record.academicLevelId, record.sectionId].map((item) => text(item)).join("|");
const newest = (records: PlanningDocument[]) => [...records].sort((left, right) =>
  number(right.versionNumber) - number(left.versionNumber) || iso(right.updatedAt).localeCompare(iso(left.updatedAt))
)[0];

function selectVersions(records: PlanningDocument[], viewMode: "PUBLISHED" | "LATEST_DRAFT", explicitId?: string) {
  const groups = new Map<string, PlanningDocument[]>();
  for (const record of records.filter((item) => ["PUBLISHED", "DRAFT"].includes(text(item.status)))) {
    const key = versionScope(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const selected = [...groups.values()].flatMap((group) => {
    const explicit = explicitId ? group.find((item) => item.id === explicitId) : undefined;
    if (explicit) return [explicit];
    const preferred = viewMode === "LATEST_DRAFT"
      ? newest(group.filter((item) => item.status === "DRAFT")) ?? newest(group.filter((item) => item.status === "PUBLISHED"))
      : newest(group.filter((item) => item.status === "PUBLISHED"));
    return preferred ? [preferred] : [];
  });
  if (explicitId && !selected.some((item) => item.id === explicitId)) {
    const explicit = records.find((item) => item.id === explicitId);
    if (!explicit) throw new NotFoundError("timetable version was not found");
    selected.push(explicit);
  }
  return selected;
}

function resolvePolicy(input: CalculationInput): WorkloadPolicyView {
  const weekEnd = endOfWeek(input.weekStartDate);
  const current = input.policies.filter((policy) => isEffective(policy, input.weekStartDate, weekEnd));
  const scope = (policy: PlanningDocument) => text(policy.scopeType) || (policy.employeeId ? "EMPLOYEE" : policy.staffType ? "STAFF_TYPE" : policy.designationId ? "DESIGNATION" : "DEFAULT");
  const candidates = [
    current.filter((policy) => scope(policy) === "EMPLOYEE" && policy.employeeId === input.teacher.id),
    current.filter((policy) => scope(policy) === "DESIGNATION" && policy.designationId === input.teacher.designation),
    current.filter((policy) => scope(policy) === "STAFF_TYPE" && policy.staffType === input.teacher.staffType),
    current.filter((policy) => scope(policy) === "DEFAULT"),
  ];
  const selected = candidates.map(newest).find(Boolean);
  const selectedScope = selected ? scope(selected) as WorkloadPolicyView["scopeType"] : "DEFAULT";
  return {
    ...(selected ? { id: text(selected.id) } : {}),
    scopeType: selectedScope,
    inheritedFrom: selected ? selectedScope.replaceAll("_", " ") : "SYSTEM DEFAULT",
    isOverride: selectedScope === "EMPLOYEE",
    maximumWeeklyPeriods: Math.max(1, number(selected?.maximumContactPeriodsPerWeek, 30)),
    maximumDailyPeriods: Math.max(1, number(selected?.maximumPeriodsPerDay, 7)),
    maximumConsecutivePeriods: Math.max(1, number(selected?.maximumConsecutivePeriods, 3)),
    ...(selected?.effectiveFrom ? { effectiveFrom: iso(selected.effectiveFrom) } : {}),
    ...(selected?.effectiveUntil ? { effectiveUntil: iso(selected.effectiveUntil) } : {}),
    ...(selected?.reason ? { reason: text(selected.reason) } : {}),
  };
}

function createLesson(entry: PlanningDocument, input: CalculationInput, state?: WorkloadLessonView["state"]): WorkloadLessonView | null {
  const version = input.selectedVersions.find((item) => item.id === entry.timetableVersionId);
  const offering = input.offerings.find((item) => item.id === entry.subjectOfferingId);
  if (!version || !offering) return null;
  const entrySlots = stringList(entry.periodSlotIds)
    .map((id) => input.slots.find((item) => item.id === id))
    .filter((item): item is PlanningDocument => Boolean(item))
    .sort((left, right) => number(left.sequence) - number(right.sequence) || text(left.startTime).localeCompare(text(right.startTime)));
  if (!entrySlots.length) return null;
  const teachingSlots = entrySlots.filter((slot) => slot.countsForTeachingWorkload !== false && !["BREAK", "LUNCH", "ASSEMBLY"].includes(text(slot.slotType)));
  const relevantSlots = teachingSlots.length ? teachingSlots : entrySlots;
  const section = input.sections.find((item) => item.id === (entry.sectionId ?? offering.sectionId));
  const batch = input.batches.find((item) => item.id === (entry.subjectBatchId ?? offering.subjectBatchId));
  const classId = text(section?.classId || batch?.academicLevelId || version.academicLevelId);
  const academicClass = input.classes.find((item) => item.id === classId);
  const programId = text(academicClass?.programId || batch?.programId || version.programId);
  const program = input.programs.find((item) => item.id === programId);
  const campusId = text(offering.campusId || version.campusId);
  const campus = input.campuses.find((item) => item.id === campusId);
  const component = input.components.find((item) => item.id === offering.subjectComponentId);
  const resolvedState = state ?? (entry.entryType === "SUBSTITUTION" ? "SUBSTITUTION" : "PERMANENT");
  const classSetupPath = classId
    ? `/admin/academics/class-setup?classId=${encodeURIComponent(classId)}${section?.id ? `&sectionId=${encodeURIComponent(text(section.id))}` : ""}&tab=subjects&subjectOfferingId=${encodeURIComponent(text(offering.id))}&subjectComponentId=${encodeURIComponent(text(offering.subjectComponentId))}`
    : undefined;
  return {
    id: text(entry.id),
    dayOfWeek: day(entry.dayOfWeek),
    startTime: text(relevantSlots[0]?.startTime),
    endTime: text(relevantSlots.at(-1)?.endTime),
    periodCount: relevantSlots.length,
    teachingSessionCount: 1,
    campusId,
    campusName: text(campus?.name) || "Unknown campus",
    ...(program?.name ? { programName: text(program.name) } : {}),
    ...(academicClass?.name ? { className: text(academicClass.name) } : {}),
    ...(section?.name ? { sectionName: text(section.name) } : {}),
    ...(batch?.name ? { subjectBatchName: text(batch.name) } : {}),
    subjectName: resolveSubjectName(offering, input),
    componentType: text(component?.componentType) || "THEORY",
    state: resolvedState,
    timetableVersionId: text(version.id),
    timetableVersionStatus: version.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
    ...(classSetupPath ? { classSetupPath } : {}),
  };
}

function longestConsecutive(lessons: WorkloadLessonView[]) {
  const intervals = [...new Map(lessons.flatMap((lesson) => {
    if (lesson.state === "CANCELLED") return [];
    return [[`${lesson.startTime}|${lesson.endTime}`, { start: lesson.startTime, end: lesson.endTime, periods: lesson.periodCount }] as const];
  })).values()].sort((left, right) => left.start.localeCompare(right.start));
  let longest = 0, current = 0, previousEnd = "";
  for (const interval of intervals) {
    current = previousEnd && previousEnd === interval.start ? current + interval.periods : interval.periods;
    longest = Math.max(longest, current);
    previousEnd = interval.end;
  }
  return longest;
}

export function calculateTeacherWorkload(input: CalculationInput): Omit<TeacherWorkloadWorkspace, "teacher" | "academicYear" | "viewMode" | "weekStartDate" | "selectedVersions"> {
  const campusMap = new Map(input.campuses.map((item) => [text(item.id), text(item.name)]));
  const policy = resolvePolicy(input);
  const selectedVersionIds = new Set(input.selectedVersions.map((item) => text(item.id)));
  const teacherAssignmentIds = new Set(input.assignments.map((item) => text(item.id)));
  const permanentEntries = input.entries.filter((entry) => selectedVersionIds.has(text(entry.timetableVersionId)) && stringList(entry.teachingAssignmentIds).some((id) => teacherAssignmentIds.has(id)) && entry.status === "ACTIVE");
  const permanentLessons = permanentEntries.map((entry) => createLesson(entry, input)).filter((item): item is WorkloadLessonView => Boolean(item));
  const lessonById = new Map(permanentLessons.map((lesson) => [lesson.id, lesson]));
  const weekEnd = endOfWeek(input.weekStartDate);
  const currentOverrides = input.overrides.filter((override) => {
    const date = toDateOnly(override.date || override.effectiveFrom);
    return override.status === "ACTIVE" && (!date || (input.weekStartDate <= date && date <= weekEnd));
  });
  let cancelledPeriods = 0;
  const cancelledLessonIds = new Set<string>();
  const substitutionLessons: WorkloadLessonView[] = [];
  for (const override of currentOverrides) {
    const targetId = text(override.timetableEntryId || override.sourceTimetableEntryId || override.targetEntryId);
    const targetEntry = input.entries.find((entry) => entry.id === targetId);
    const targetLesson = targetId ? lessonById.get(targetId) ?? (targetEntry ? createLesson(targetEntry, input) : null) : null;
    const action = text(override.action || override.overrideType).toUpperCase();
    const substituteId = text(override.substituteEmployeeId || override.replacementEmployeeId);
    const originalId = text(override.originalEmployeeId);
    if (targetLesson && (["CANCEL", "CANCELLED"].includes(action) || (substituteId && input.teacher.id === originalId))) {
      if (!cancelledLessonIds.has(targetLesson.id)) {
        cancelledLessonIds.add(targetLesson.id);
        cancelledPeriods += targetLesson.periodCount;
      }
    }
    if (targetEntry && substituteId === input.teacher.id && ["SUBSTITUTE", "SUBSTITUTION"].includes(action)) {
      const lesson = createLesson({ ...targetEntry, id: text(override.id), dayOfWeek: override.dayOfWeek || targetEntry.dayOfWeek }, input, "SUBSTITUTION");
      if (lesson) substitutionLessons.push(lesson);
    }
  }
  const displayedPermanent = permanentLessons.map((lesson) => cancelledLessonIds.has(lesson.id) ? { ...lesson, state: "CANCELLED" as const } : lesson);
  const lessons = [...displayedPermanent, ...substitutionLessons].sort((left, right) => DAYS.indexOf(left.dayOfWeek as typeof DAYS[number]) - DAYS.indexOf(right.dayOfWeek as typeof DAYS[number]) || left.startTime.localeCompare(right.startTime));
  const scheduledPermanent = permanentLessons.filter((lesson) => lesson.state === "PERMANENT").reduce((sum, lesson) => sum + lesson.periodCount, 0);
  const substitutionPeriods = substitutionLessons.reduce((sum, lesson) => sum + lesson.periodCount, 0);
  const actualLessons = lessons.filter((lesson) => lesson.state !== "CANCELLED");
  const actualWeeklyPeriods = actualLessons.reduce((sum, lesson) => sum + lesson.periodCount, 0);

  const assignmentViews: WorkloadAssignmentView[] = input.assignments.flatMap((assignment) => {
    const offering = input.offerings.find((item) => item.id === assignment.subjectOfferingId);
    if (!offering) return [];
    const component = input.components.find((item) => item.id === offering.subjectComponentId);
    const section = input.sections.find((item) => item.id === offering.sectionId);
    const batch = input.batches.find((item) => item.id === offering.subjectBatchId);
    const classId = text(section?.classId || batch?.academicLevelId);
    const academicClass = input.classes.find((item) => item.id === classId);
    const programId = text(academicClass?.programId || batch?.programId);
    const program = input.programs.find((item) => item.id === programId);
    const share = Math.max(0, number(assignment.workloadSharePercentage, 100)) / 100;
    const requiredPeriods = Math.round(number(offering.requiredPeriodsPerWeek) * share * 100) / 100;
    const scheduledPeriods = permanentLessons.filter((lesson) => lesson.state === "PERMANENT" && permanentEntries.find((entry) => entry.id === lesson.id)?.subjectOfferingId === offering.id).reduce((sum, lesson) => sum + lesson.periodCount, 0);
    const unscheduledPeriods = Math.max(0, requiredPeriods - scheduledPeriods);
    const campusId = text(offering.campusId);
    const classSetupPath = classId ? `/admin/academics/class-setup?classId=${encodeURIComponent(classId)}${section?.id ? `&sectionId=${encodeURIComponent(text(section.id))}` : ""}&tab=subjects&subjectOfferingId=${encodeURIComponent(text(offering.id))}&subjectComponentId=${encodeURIComponent(text(offering.subjectComponentId))}` : undefined;
    return [{
      id: text(assignment.id), campusId, campusName: campusMap.get(campusId) || "Unknown campus",
      ...(programId ? { programId } : {}), ...(program?.name ? { programName: text(program.name) } : {}),
      ...(classId ? { classId } : {}), ...(academicClass?.name ? { className: text(academicClass.name) } : {}),
      ...(section?.id ? { sectionId: text(section.id) } : {}), ...(section?.name ? { sectionName: text(section.name) } : {}),
      ...(batch?.id ? { subjectBatchId: text(batch.id) } : {}), ...(batch?.name ? { subjectBatchName: text(batch.name) } : {}),
      subjectOfferingId: text(offering.id), subjectComponentId: text(offering.subjectComponentId), subjectName: resolveSubjectName(offering, input),
      componentType: text(component?.componentType) || "THEORY", assignmentRole: text(assignment.assignmentRole), requiredPeriods, scheduledPeriods, unscheduledPeriods,
      status: unscheduledPeriods > 0 ? "INCOMPLETE" : "COMPLETE", ...(classSetupPath ? { classSetupPath } : {}),
    }];
  });
  const requiredPeriods = assignmentViews.reduce((sum, item) => sum + item.requiredPeriods, 0);
  const unscheduledPeriods = Math.max(0, requiredPeriods - scheduledPermanent);
  const componentMultipliers = input.policies.find((item) => item.id === policy.id)?.componentMultipliers;
  const multiplierMap = componentMultipliers && typeof componentMultipliers === "object" && !Array.isArray(componentMultipliers) ? componentMultipliers as Record<string, unknown> : {};
  const weightedUnits = assignmentViews.reduce((sum, item) => sum + item.requiredPeriods * number(multiplierMap[item.componentType], number(input.components.find((component) => component.id === item.subjectComponentId)?.workloadMultiplier, 1)), 0);

  const dailyBreakdown = DAYS.map((dayOfWeek) => {
    const permanent = displayedPermanent.filter((lesson) => lesson.dayOfWeek === dayOfWeek && lesson.state === "PERMANENT");
    const actual = actualLessons.filter((lesson) => lesson.dayOfWeek === dayOfWeek);
    return { dayOfWeek, scheduledPeriods: permanent.reduce((sum, lesson) => sum + lesson.periodCount, 0), actualPeriods: actual.reduce((sum, lesson) => sum + lesson.periodCount, 0), maximumConsecutivePeriods: longestConsecutive(actual) };
  });
  const campusIds = new Set([...assignmentViews.map((item) => item.campusId), ...actualLessons.map((item) => item.campusId)]);
  const campusBreakdown = [...campusIds].map((campusId) => ({
    campusId, campusName: campusMap.get(campusId) || "Unknown campus",
    requiredPeriods: assignmentViews.filter((item) => item.campusId === campusId).reduce((sum, item) => sum + item.requiredPeriods, 0),
    scheduledPeriods: displayedPermanent.filter((item) => item.campusId === campusId && item.state === "PERMANENT").reduce((sum, item) => sum + item.periodCount, 0),
    actualPeriods: actualLessons.filter((item) => item.campusId === campusId).reduce((sum, item) => sum + item.periodCount, 0),
  }));
  const componentTypes = new Set(assignmentViews.map((item) => item.componentType));
  const componentBreakdown = [...componentTypes].map((componentType) => ({
    componentType,
    requiredPeriods: assignmentViews.filter((item) => item.componentType === componentType).reduce((sum, item) => sum + item.requiredPeriods, 0),
    scheduledPeriods: actualLessons.filter((lesson) => lesson.componentType === componentType).reduce((sum, lesson) => sum + lesson.periodCount, 0),
    weightedUnits: assignmentViews.filter((item) => item.componentType === componentType).reduce((sum, item) => sum + item.requiredPeriods * number(multiplierMap[componentType], number(input.components.find((component) => component.id === item.subjectComponentId)?.workloadMultiplier, 1)), 0),
  }));

  const issues: WorkloadIssueView[] = [];
  for (const assignment of assignmentViews.filter((item) => item.unscheduledPeriods > 0)) issues.push({ code: "REQUIRED_PERIODS_UNSCHEDULED", severity: "WARNING", classSection: [assignment.className, assignment.sectionName || assignment.subjectBatchName].filter(Boolean).join(" / "), subjectName: assignment.subjectName, reason: `${assignment.unscheduledPeriods} required period${assignment.unscheduledPeriods === 1 ? " is" : "s are"} not scheduled.`, recommendedAction: "Open Class Setup", ...(assignment.classSetupPath ? { actionPath: assignment.classSetupPath } : {}) });
  if (actualWeeklyPeriods > policy.maximumWeeklyPeriods) issues.push({ code: "WEEKLY_WORKLOAD_EXCEEDED", severity: "ERROR", reason: `${actualWeeklyPeriods} periods exceeds the weekly maximum of ${policy.maximumWeeklyPeriods}.`, recommendedAction: "Review Workload Limit" });
  for (const daily of dailyBreakdown) {
    if (daily.actualPeriods > policy.maximumDailyPeriods) issues.push({ code: "DAILY_WORKLOAD_EXCEEDED", severity: "ERROR", dayOfWeek: daily.dayOfWeek, reason: `${daily.actualPeriods} periods exceeds the daily maximum of ${policy.maximumDailyPeriods}.`, recommendedAction: "Open Timetable" });
    if (daily.maximumConsecutivePeriods > policy.maximumConsecutivePeriods) issues.push({ code: "CONSECUTIVE_PERIODS_EXCEEDED", severity: "ERROR", dayOfWeek: daily.dayOfWeek, reason: `${daily.maximumConsecutivePeriods} consecutive periods exceeds the maximum of ${policy.maximumConsecutivePeriods}.`, recommendedAction: "Open Timetable" });
  }
  const availabilityExceptions = input.availability.filter((item) => isEffective(item, input.weekStartDate, weekEnd)).map((item) => ({
    id: text(item.id), ...(item.campusId ? { campusId: text(item.campusId) } : {}), dayOfWeek: day(item.dayOfWeek), startTime: text(item.startTime), endTime: text(item.endTime),
    type: (item.availabilityType === "PREFERRED" ? "PREFERRED" : "BLOCKED") as "BLOCKED" | "PREFERRED", effectiveFrom: iso(item.effectiveFrom), ...(item.effectiveUntil ? { effectiveUntil: iso(item.effectiveUntil) } : {}), ...(item.reason ? { reason: text(item.reason) } : {}),
  }));
  for (const lesson of actualLessons) for (const exception of availabilityExceptions.filter((item) => item.type === "BLOCKED" && item.dayOfWeek === lesson.dayOfWeek && (!item.campusId || item.campusId === lesson.campusId) && overlapsTime(item.startTime, item.endTime, lesson.startTime, lesson.endTime))) issues.push({ code: "BLOCKED_AVAILABILITY", severity: "ERROR", dayOfWeek: lesson.dayOfWeek, startTime: lesson.startTime, endTime: lesson.endTime, classSection: [lesson.className, lesson.sectionName || lesson.subjectBatchName].filter(Boolean).join(" / "), subjectName: lesson.subjectName, reason: "Lesson is scheduled during blocked availability.", recommendedAction: "Change Availability", ...(lesson.classSetupPath ? { actionPath: lesson.classSetupPath } : {}) });

  for (const dayOfWeek of DAYS) {
    const daily = actualLessons.filter((lesson) => lesson.dayOfWeek === dayOfWeek).sort((left, right) => left.startTime.localeCompare(right.startTime));
    for (let leftIndex = 0; leftIndex < daily.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < daily.length; rightIndex += 1) {
      const left = daily[leftIndex]!, right = daily[rightIndex]!;
      if (overlapsTime(left.startTime, left.endTime, right.startTime, right.endTime)) issues.push({ code: left.campusId === right.campusId ? "TEACHER_COLLISION" : "CROSS_CAMPUS_COLLISION", severity: "ERROR", dayOfWeek, startTime: left.startTime, endTime: left.endTime > right.endTime ? left.endTime : right.endTime, classSection: [left.className, left.sectionName].filter(Boolean).join(" / "), subjectName: left.subjectName, conflictingAssignment: `${[right.className, right.sectionName].filter(Boolean).join(" / ")} - ${right.subjectName}`, reason: left.campusId === right.campusId ? "Teacher has overlapping lessons." : `Teacher is scheduled at ${left.campusName} and ${right.campusName} at the same time.`, recommendedAction: "Open Timetable", ...(left.classSetupPath ? { actionPath: left.classSetupPath } : {}) });
      else if (left.campusId !== right.campusId && left.endTime <= right.startTime) {
        const rule = input.travelRules.find((item) => (item.sourceCampusId === left.campusId && item.targetCampusId === right.campusId) || (item.sourceCampusId === right.campusId && item.targetCampusId === left.campusId));
        const gap = timeMinutes(right.startTime) - timeMinutes(left.endTime);
        if (rule && gap < number(rule.minimumTravelMinutes)) issues.push({ code: "CROSS_CAMPUS_TRAVEL", severity: "ERROR", dayOfWeek, startTime: left.endTime, endTime: right.startTime, classSection: [right.className, right.sectionName].filter(Boolean).join(" / "), subjectName: right.subjectName, conflictingAssignment: `${left.campusName} to ${right.campusName}`, reason: `${gap} minutes is less than the required ${number(rule.minimumTravelMinutes)} minutes of campus travel time.`, recommendedAction: "Open Timetable", ...(right.classSetupPath ? { actionPath: right.classSetupPath } : {}) });
      }
    }
  }
  for (const assignment of assignmentViews) {
    const source = input.assignments.find((item) => item.id === assignment.id)!;
    const access = input.campusAssignments.some((item) => item.employeeId === input.teacher.id && item.campusId === assignment.campusId && item.availableForTeaching === true && item.status === "ACTIVE" && isEffective(item, input.weekStartDate, weekEnd));
    if (!access) issues.push({ code: "MISSING_CAMPUS_ACCESS", severity: "ERROR", classSection: [assignment.className, assignment.sectionName].filter(Boolean).join(" / "), subjectName: assignment.subjectName, reason: `Teacher has no active teaching access for ${assignment.campusName}.`, recommendedAction: "Review Campus Access", ...(assignment.classSetupPath ? { actionPath: assignment.classSetupPath } : {}) });
    if (!isEffective(source, toDateOnly(input.academicYear.startDate) || input.weekStartDate, toDateOnly(input.academicYear.endDate) || weekEnd)) issues.push({ code: "ASSIGNMENT_OUTSIDE_EFFECTIVE_PERIOD", severity: "ERROR", classSection: [assignment.className, assignment.sectionName].filter(Boolean).join(" / "), subjectName: assignment.subjectName, reason: "Teaching assignment does not cover the selected academic year.", recommendedAction: "Open Class Setup", ...(assignment.classSetupPath ? { actionPath: assignment.classSetupPath } : {}) });
  }

  const responsibilities = input.responsibilities.filter((item) => isEffective(item, input.weekStartDate, weekEnd)).map((item) => {
    const academicClass = input.classes.find((record) => record.id === item.academicLevelId);
    const section = input.sections.find((record) => record.id === item.sectionId);
    return { id: text(item.id), responsibilityType: text(item.responsibilityType), campusId: text(item.campusId), campusName: campusMap.get(text(item.campusId)) || "Unknown campus", ...(academicClass?.id ? { classId: text(academicClass.id), className: text(academicClass.name) } : {}), ...(section?.id ? { sectionId: text(section.id), sectionName: text(section.name) } : {}), effectiveFrom: iso(item.effectiveFrom), ...(item.effectiveUntil ? { effectiveUntil: iso(item.effectiveUntil) } : {}) };
  });
  return {
    policy,
    summary: { requiredPeriods, scheduledPeriods: scheduledPermanent, unscheduledPeriods, permanentPeriods: scheduledPermanent, actualWeeklyPeriods, teachingSessions: actualLessons.length, substitutionPeriods, cancelledPeriods, maximumWeeklyPeriods: policy.maximumWeeklyPeriods, remainingCapacity: Math.max(0, policy.maximumWeeklyPeriods - actualWeeklyPeriods), overloadPeriods: Math.max(0, actualWeeklyPeriods - policy.maximumWeeklyPeriods), maximumConsecutivePeriods: Math.max(0, ...dailyBreakdown.map((item) => item.maximumConsecutivePeriods)), weightedUnits },
    campusBreakdown, componentBreakdown, dailyBreakdown, assignments: assignmentViews, timetableEntries: lessons, availabilityExceptions, responsibilities, issues,
  };
}

function requestTenant(ctx: RequestContext) {
  const value = ctx.tenantContext?.tenantId?.trim();
  if (!value) throw new BadRequestError("tenantId is required");
  return value;
}

function canRead(ctx: RequestContext, teacher: PlanningDocument) {
  const permissions = ctx.authContext?.user?.permissions ?? [];
  const admin = permissions.includes("academics.faculty-planning.read" as Permission) || permissions.includes("academics.teacher-workload.read" as Permission);
  const own = permissions.includes("academics.teacher-workload.read-own" as Permission) && teacher.userId === ctx.authContext?.user?.id;
  if (!admin && !own) throw new ForbiddenError("permission academics.teacher-workload.read is required");
}

export async function getTeacherWorkloadWorkspace(value: unknown, ctx: RequestContext, deps?: TeacherWorkloadDependencies): Promise<TeacherWorkloadWorkspace> {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const teacherId = text(input.teacherId).trim(), academicYearId = text(input.academicYearId).trim();
  if (!teacherId || !academicYearId) throw new ValidationError([{ field: !teacherId ? "teacherId" : "academicYearId", message: `${!teacherId ? "teacherId" : "academicYearId"} is required` }]);
  const viewMode = input.viewMode === "LATEST_DRAFT" ? "LATEST_DRAFT" : "PUBLISHED";
  const weekStartDate = monday(text(input.weekStartDate) || undefined);
  const repository = deps?.store ?? planningStore(), tenantId = requestTenant(ctx);
  const [teacher, academicYear] = await Promise.all([
    repository.get("identity_employees", tenantId, teacherId),
    repository.get("settings_academic_years", tenantId, academicYearId),
  ]);
  if (!teacher || teacher.status !== "ACTIVE") throw new NotFoundError("active teacher was not found");
  if (teacher.staffCategory !== "TEACHING") throw new ValidationError([{ field: "teacherId", message: "employee is not teaching staff" }]);
  if (!academicYear) throw new NotFoundError("academic year was not found");
  canRead(ctx, teacher);
  const [versions, assignments, offerings, components, curriculumSubjects, subjectCatalogue, policies, availability, campusAssignments, responsibilities, campuses, programs, classes, sections, batches, allEntries, overrides, slots, travelRules] = await Promise.all([
    repository.list("timetable_versions", tenantId, { academicYearId }),
    repository.list("teaching_assignments_v2", tenantId, { employeeId: teacherId, status: "ACTIVE" }),
    repository.list("subject_offerings", tenantId, { academicYearId, status: "ACTIVE" }),
    repository.list("subject_components", tenantId, { status: "ACTIVE" }),
    repository.list("curriculum_subjects", tenantId, { status: "ACTIVE" }),
    repository.list("subject_catalogue", tenantId, { status: "ACTIVE" }),
    repository.list("teacher_workload_policies", tenantId, { status: "ACTIVE" }),
    repository.list("teacher_availability", tenantId, { employeeId: teacherId, academicYearId, status: "ACTIVE" }),
    repository.list("employee_campus_assignments", tenantId, { employeeId: teacherId, status: "ACTIVE" }),
    repository.list("academic_responsibilities", tenantId, { employeeId: teacherId, academicYearId, status: "ACTIVE" }),
    repository.list("settings_campuses", tenantId), repository.list("academics_programs", tenantId), repository.list("academics_classes", tenantId), repository.list("academics_sections", tenantId),
    repository.list("subject_batches", tenantId, { academicYearId, status: "ACTIVE" }), repository.list("timetable_entries", tenantId, { status: "ACTIVE" }), repository.list("timetable_temporary_overrides", tenantId, { status: "ACTIVE" }), repository.list("timetable_period_slots", tenantId, { status: "ACTIVE" }), repository.list("campus_travel_rules", tenantId, { status: "ACTIVE" }),
  ]);
  const selectedVersions = selectVersions(versions, viewMode, text(input.timetableVersionId) || undefined);
  const calculated = calculateTeacherWorkload({ teacher, academicYear, weekStartDate, viewMode, selectedVersions, entries: allEntries, overrides, assignments, offerings, components, curriculumSubjects, subjectCatalogue, policies, availability, campusAssignments, responsibilities, campuses, programs, classes, sections, batches, slots, travelRules });
  return {
    teacher: { id: text(teacher.id), employeeCode: text(teacher.employeeCode), fullName: text(teacher.fullName), ...(teacher.department ? { department: text(teacher.department) } : {}), ...(teacher.designation ? { designation: text(teacher.designation) } : {}), staffType: text(teacher.staffType), primaryCampusId: text(teacher.primaryCampusId), campusIds: stringList(teacher.campusIds) },
    academicYear: { id: text(academicYear.id), name: text(academicYear.name), ...(academicYear.startDate ? { startDate: dateTime(academicYear.startDate)! } : {}), ...(academicYear.endDate ? { endDate: dateTime(academicYear.endDate)! } : {}) },
    viewMode, weekStartDate: `${weekStartDate}T00:00:00.000Z`,
    selectedVersions: selectedVersions.map((version) => ({ id: text(version.id), name: text(version.name), status: version.status === "DRAFT" ? "DRAFT" : "PUBLISHED", campusId: text(version.campusId) })),
    ...calculated,
  };
}
