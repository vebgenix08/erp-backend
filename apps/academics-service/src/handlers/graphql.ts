import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import { academicsPermissions } from "../permissions";
import { createProgram, deactivateProgram, listPrograms, updateProgram } from "../modules/programs/programs.service";
import { createClass, deactivateClass, listClasses, updateClass } from "../modules/classes/classes.service";
import { createSection, deactivateSection, listSections, updateSection } from "../modules/sections/sections.service";
import { createSubject, deactivateSubject, listSubjects, updateSubject } from "../modules/subjects/subjects.service";
import { changeStudentEnrollment, generateClassRegistrationNumbers, generateSectionRollNumbers, getStudent, getStudentByAdmissionApplicationId, listStudentPage, listStudents } from "../modules/students/students.service";
import { hydrateAcademicsRuntimeConfig } from "./runtime-config";
import { createTeachingAssignment, deactivateTeachingAssignment, listTeachingAssignments } from "../modules/teaching-assignments/teaching-assignments.service";
import { getStudentDocument, issueStudentDocument, listStudentDocuments, revokeStudentDocument } from "../modules/student-documents/student-documents.service";
import { createStudentNote, listStudentNotes, updateStudentNote } from "../modules/student-notes/student-notes.service";
import { createCurriculum, deactivateCurriculum, listCurricula, updateCurriculum } from "../modules/curricula/curricula.service";
import { createAcademicOffering, deactivateAcademicOffering, listAcademicOfferings, updateAcademicOffering } from "../modules/academic-offerings/academic-offerings.service";
import { createSubjectCatalogue, deactivateSubjectCatalogue, getSubjectCatalogue, listSubjectCatalogue, updateSubjectCatalogue } from "../modules/subject-catalogue/subject-catalogue.service";
import { createCurriculumSubject, deactivateCurriculumSubject, listCurriculumSubjects, updateCurriculumSubject } from "../modules/curriculum-subjects/curriculum-subjects.service";
import { createSubjectComponent, deactivateSubjectComponent, listSubjectComponents } from "../modules/subject-components/subject-components.service";
import { activateSubjectPlan, createSubjectPlan, listSubjectPlans } from "../modules/academic-year-subject-plans/academic-year-subject-plans.service";
import { addSubjectBatchMembership, addTeachingGroupMembership, createParallelBlockRecord, createSectionSubjectException, createSubjectBatch, createSubjectChoiceGroup, createSubjectOfferingRecord, createTeachingGroupRecord, listDeliveryRecords, listSubjectOfferingRecords, selectStudentSubject } from "../modules/learning-delivery/learning-delivery.service";
import { addAcademicResponsibility, addTeacherEligibility, assignEmployeeCampus, assignOfferingTeacher, facultyWorkload, listFacultyRecords, saveWorkloadPolicy, setTeacherAvailability } from "../modules/faculty-planning/faculty-planning.service";
import { addTimetableEntry, createCampusTravelRule, createPeriodSetRecord, createPeriodSlotRecord, createRoomRecord, createTimetableConstraint, createTimetableRevision, createTimetableVersion, deactivateTimetableEntry, generateTimetable, listTimetableRecords, publishTimetable, resolveTimetableConflict, timetableReadiness, updateTimetableEntry, validateTimetable } from "../modules/timetable/timetable.service";
import { generateClassTimetable, getClassSetupWorkspace, removeClassSetupSubject, saveClassSetupTiming, updateClassSetupSubject } from "../modules/class-setup/class-setup.service";
import { getTeacherWorkloadWorkspace } from "../modules/teacher-workload/teacher-workload.service";
import { StartExecutionCommand, SFNClient } from "@aws-sdk/client-sfn";
import { approveCampusTransfer, cancelCampusTransfer, createCampusTransfer, getCampusTransfer, listCampusTransferPage, listCampusTransfers, retryCampusTransfer } from "../modules/campus-transfers/campus-transfers.service";

interface Event { info: { fieldName: string }; arguments?: Record<string, unknown>; identity?: { sub?: string; claims?: Record<string, unknown> } | null; request?: { headers?: Record<string, string> }; }
const ADMIN_PERMISSIONS = Object.values(academicsPermissions).flatMap((resource) => Object.values(resource));
function claim(claims: Record<string, unknown>, ...names: string[]) { for (const name of names) { const value = claims[name]; if (typeof value === "string" && value.trim()) return value.trim(); } return undefined; }
function context(event: Event): RequestContext {
  const claims = event.identity?.claims ?? {};
  const groupsValue = claims["cognito:groups"];
  const groups = Array.isArray(groupsValue) ? groupsValue : typeof groupsValue === "string" ? groupsValue.split(",") : [];
  const role = claim(claims, "custom:role", "role") ?? (groups.includes("TENANT_ADMIN") ? "TENANT_ADMIN" : undefined);
  const userId = event.identity?.sub ?? claim(claims, "sub");
  const tenantId = claim(claims, "custom:tenantId", "tenantId");
  if (!userId || !tenantId) throw new ForbiddenError("authenticated tenant identity is required");
  const permissions = normalizePermissions([...(role === "TENANT_ADMIN" ? ADMIN_PERMISSIONS : []), ...normalizePermissions(claims["custom:permissions"] ?? claims.permissions)]);
  return { requestId: event.request?.headers?.["x-amzn-trace-id"] ?? `gql_${crypto.randomUUID()}`, path: `graphql:${event.info.fieldName}`, method: "POST", headers: event.request?.headers ?? {}, query: {}, body: event.arguments ?? {}, params: {}, tenantContext: { tenantId, source: "jwt-claims", resolvedAt: new Date() }, authContext: { source: "jwt-claims", authenticatedAt: new Date(), user: { id: userId, email: claim(claims, "email"), role, permissions, source: "jwt-claims" } } };
}
function input(args: Record<string, unknown>) { if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) throw new ValidationError([{ field: "input", message: "input is required" }]); return args.input as Record<string, unknown>; }
function id(args: Record<string, unknown>) { if (typeof args.id !== "string" || !args.id.trim()) throw new ValidationError([{ field: "id", message: "id is required" }]); return args.id.trim(); }
function filter(args: Record<string, unknown>) { return args.filter && typeof args.filter === "object" && !Array.isArray(args.filter) ? args.filter : undefined; }
function campusTransferOrchestrator() {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const stateMachineArn = env.CAMPUS_TRANSFER_STATE_MACHINE_ARN?.trim();
  if (!stateMachineArn) throw new Error("CAMPUS_TRANSFER_STATE_MACHINE_ARN is required");
  const client = new SFNClient({});
  return { start: async (payload: { transferId: string; tenantId: string; financeApproved: boolean }) => {
    const attempt = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const executionName = `${payload.transferId}-${payload.financeApproved ? "approved" : "run"}-${attempt}`.replace(/[^A-Za-z0-9-_]/g, "-").slice(0, 80);
    const response = await client.send(new StartExecutionCommand({ stateMachineArn, name: executionName, input: JSON.stringify(payload) }));
    if (!response.executionArn) throw new Error("Step Functions did not return an execution ARN");
    return { executionArn: response.executionArn };
  } };
}

export async function handleAcademicsGraphql(event: Event): Promise<unknown> {
  const ctx = context(event); const args = event.arguments ?? {};
  switch (event.info.fieldName) {
    case "curricula": return listCurricula(ctx, filter(args));
    case "academicOfferings": return listAcademicOfferings(ctx, filter(args));
    case "academicPrograms": return listPrograms(ctx, undefined, filter(args));
    case "academicClasses": return listClasses(ctx, undefined, filter(args));
    case "academicSections": return listSections(ctx, undefined, filter(args));
    case "academicSubjects": return listSubjects(ctx, undefined, filter(args));
    case "subjectCatalogue": return listSubjectCatalogue(ctx, filter(args));
    case "subjectCatalogueItem": return getSubjectCatalogue(id(args), ctx);
    case "curriculumSubjects": return listCurriculumSubjects(ctx, filter(args));
    case "subjectComponents": return listSubjectComponents(ctx, typeof args.curriculumSubjectId === "string" ? args.curriculumSubjectId : undefined);
    case "academicYearSubjectPlans": return listSubjectPlans(ctx, (filter(args) ?? {}) as Record<string, unknown>);
    case "sectionSubjectExceptions": return listDeliveryRecords("section_subject_exceptions", "section-subject-exception", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "subjectChoiceGroups": return listDeliveryRecords("subject_choice_groups", "subject-choice-group", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "studentSubjectChoices": return listDeliveryRecords("student_subject_choices", "student-subject-choice", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "teachingGroups": return listDeliveryRecords("teaching_groups", "teaching-group", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "teachingGroupMemberships": return listDeliveryRecords("teaching_group_memberships", "teaching-group", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "subjectBatches": return listDeliveryRecords("subject_batches", "subject-batch", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "subjectBatchMemberships": return listDeliveryRecords("subject_batch_memberships", "subject-batch", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "subjectOfferings": return listSubjectOfferingRecords((filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "parallelTimetableBlocks": return listDeliveryRecords("parallel_timetable_blocks", "timetable", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "employeeCampusAssignments": return listFacultyRecords("employee_campus_assignments", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "teacherSubjectEligibility": return listFacultyRecords("teacher_subject_eligibility", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "offeringTeacherAssignments": return listFacultyRecords("teaching_assignments_v2", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "academicResponsibilities": return listFacultyRecords("academic_responsibilities", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "teacherAvailability": return listFacultyRecords("teacher_availability", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "teacherWorkloadPolicies": return listFacultyRecords("teacher_workload_policies", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "facultyWorkload": return facultyWorkload(id({ id: args.employeeId }), ctx);
    case "teacherWorkloadWorkspace": return getTeacherWorkloadWorkspace(input(args), ctx);
    case "academicRooms": return listTimetableRecords("rooms", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "campusTravelRules": return listTimetableRecords("campus_travel_rules", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetablePeriodSets": return listTimetableRecords("timetable_period_sets", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetablePeriodSlots": return listTimetableRecords("timetable_period_slots", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetableVersions": return listTimetableRecords("timetable_versions", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetableEntries": return listTimetableRecords("timetable_entries", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetableReadiness": return timetableReadiness(id({ id: args.campusId }), id({ id: args.academicYearId }), ctx);
    case "timetableValidationRuns": return listTimetableRecords("timetable_validation_runs", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetableConflicts": return listTimetableRecords("timetable_conflicts", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "timetableConstraints": return listTimetableRecords("timetable_constraints", (filter(args) ?? {}) as Record<string, unknown>, ctx);
    case "classSetupWorkspace": return getClassSetupWorkspace(input(args), ctx);
    case "teachingAssignments": return listTeachingAssignments(ctx, filter(args));
    case "students": return listStudents(ctx, filter(args));
    case "studentPage": return listStudentPage(ctx, filter(args));
    case "student": return getStudent(id(args), ctx);
    case "studentByAdmissionApplicationId": return getStudentByAdmissionApplicationId(id(args), ctx);
    case "studentDocuments": return listStudentDocuments(filter(args), ctx);
    case "studentDocument": return getStudentDocument(id(args), ctx);
    case "studentNotes": return listStudentNotes(id(args), ctx);
    case "campusTransfers": return listCampusTransfers(id({ id: args.studentId }), ctx);
    case "campusTransferPage": return listCampusTransferPage((filter(args) ?? {}) as never, ctx);
    case "campusTransfer": return getCampusTransfer(id(args), ctx);
    case "changeStudentEnrollment": return changeStudentEnrollment(id(args), input(args), ctx);
    case "generateClassRegistrationNumbers": return generateClassRegistrationNumbers(input(args), ctx);
    case "generateSectionRollNumbers": return generateSectionRollNumbers(input(args), ctx);
    case "createCampusTransfer": return createCampusTransfer(input(args), ctx, { orchestrator: campusTransferOrchestrator() });
    case "approveCampusTransfer": return approveCampusTransfer(id(args), ctx, { orchestrator: campusTransferOrchestrator() });
    case "retryCampusTransfer": return retryCampusTransfer(id(args), ctx, { orchestrator: campusTransferOrchestrator() });
    case "cancelCampusTransfer": return cancelCampusTransfer(id(args), typeof args.reason === "string" ? args.reason : "", ctx);
    case "createCurriculum": return createCurriculum(input(args), ctx);
    case "updateCurriculum": return updateCurriculum(id(args), input(args), ctx);
    case "deactivateCurriculum": return deactivateCurriculum(id(args), ctx);
    case "createAcademicOffering": return createAcademicOffering(input(args), ctx);
    case "updateAcademicOffering": return updateAcademicOffering(id(args), input(args), ctx);
    case "deactivateAcademicOffering": return deactivateAcademicOffering(id(args), ctx);
    case "createAcademicProgram": return createProgram(input(args), ctx);
    case "updateAcademicProgram": return updateProgram(id(args), input(args), ctx);
    case "deactivateAcademicProgram": return deactivateProgram(id(args), ctx);
    case "createAcademicClass": return createClass(input(args), ctx);
    case "updateAcademicClass": return updateClass(id(args), input(args), ctx);
    case "deactivateAcademicClass": return deactivateClass(id(args), ctx);
    case "createAcademicSection": return createSection(input(args), ctx);
    case "updateAcademicSection": return updateSection(id(args), input(args), ctx);
    case "deactivateAcademicSection": return deactivateSection(id(args), ctx);
    case "createAcademicSubject": return createSubject(input(args), ctx);
    case "updateAcademicSubject": return updateSubject(id(args), input(args), ctx);
    case "deactivateAcademicSubject": return deactivateSubject(id(args), ctx);
    case "createSubjectCatalogueItem": return createSubjectCatalogue(input(args), ctx);
    case "updateSubjectCatalogueItem": return updateSubjectCatalogue(id(args), input(args), ctx);
    case "deactivateSubjectCatalogueItem": return deactivateSubjectCatalogue(id(args), typeof args.reason === "string" ? args.reason : "", ctx);
    case "createCurriculumSubject": return createCurriculumSubject(input(args), ctx);
    case "updateCurriculumSubject": return updateCurriculumSubject(id(args), input(args), ctx);
    case "deactivateCurriculumSubject": return deactivateCurriculumSubject(id(args), typeof args.reason === "string" ? args.reason : "", ctx);
    case "createSubjectComponent": return createSubjectComponent(input(args), ctx);
    case "deactivateSubjectComponent": return deactivateSubjectComponent(id(args), typeof args.reason === "string" ? args.reason : "", ctx);
    case "createAcademicYearSubjectPlan": return createSubjectPlan(input(args), ctx);
    case "activateAcademicYearSubjectPlan": return activateSubjectPlan(id(args), ctx);
    case "createSectionSubjectException": return createSectionSubjectException(input(args), ctx);
    case "createSubjectChoiceGroup": return createSubjectChoiceGroup(input(args), ctx);
    case "selectStudentSubject": return selectStudentSubject(input(args), ctx);
    case "createTeachingGroup": return createTeachingGroupRecord(input(args), ctx);
    case "addTeachingGroupMembership": return addTeachingGroupMembership(input(args), ctx);
    case "createSubjectBatch": return createSubjectBatch(input(args), ctx);
    case "addSubjectBatchMembership": return addSubjectBatchMembership(input(args), ctx);
    case "createSubjectOffering": return createSubjectOfferingRecord(input(args), ctx);
    case "createParallelTimetableBlock": return createParallelBlockRecord(input(args), ctx);
    case "assignEmployeeCampus": return assignEmployeeCampus(input(args), ctx);
    case "addTeacherEligibility": return addTeacherEligibility(input(args), ctx);
    case "assignOfferingTeacher": return assignOfferingTeacher(input(args), ctx);
    case "addAcademicResponsibility": return addAcademicResponsibility(input(args), ctx);
    case "setTeacherAvailability": return setTeacherAvailability(input(args), ctx);
    case "saveTeacherWorkloadPolicy": return saveWorkloadPolicy(input(args), ctx);
    case "createAcademicRoom": return createRoomRecord(input(args), ctx);
    case "createCampusTravelRule": return createCampusTravelRule(input(args), ctx);
    case "createTimetablePeriodSet": return createPeriodSetRecord(input(args), ctx);
    case "createTimetablePeriodSlot": return createPeriodSlotRecord(input(args), ctx);
    case "createTimetableVersion": return createTimetableVersion(input(args), ctx);
    case "addTimetableEntry": return addTimetableEntry(input(args), ctx);
    case "updateTimetableEntry": return updateTimetableEntry(id(args), input(args), ctx);
    case "deactivateTimetableEntry": return deactivateTimetableEntry(id(args), ctx);
    case "createTimetableRevision": return createTimetableRevision(id(args), ctx);
    case "generateTimetable": return generateTimetable(id(args), ctx);
    case "validateTimetable": return validateTimetable(id(args), ctx);
    case "publishTimetable": return publishTimetable(id(args), id({ id: args.validationRunId }), ctx);
    case "createTimetableConstraint": return createTimetableConstraint(input(args), ctx);
    case "resolveTimetableConflict": return resolveTimetableConflict(id(args), typeof args.overrideReason === "string" ? args.overrideReason : undefined, ctx);
    case "generateClassTimetable": return generateClassTimetable(input(args), ctx);
    case "updateClassSetupSubject": return updateClassSetupSubject(input(args), ctx);
    case "removeClassSetupSubject": return removeClassSetupSubject(input(args), ctx);
    case "saveClassSetupTiming": return saveClassSetupTiming(input(args), ctx);
    case "createTeachingAssignment": return createTeachingAssignment(input(args), ctx);
    case "deactivateTeachingAssignment": return deactivateTeachingAssignment(id(args), ctx);
    case "issueStudentDocument": return issueStudentDocument(input(args), ctx);
    case "revokeStudentDocument": return revokeStudentDocument(id(args), typeof args.reason === "string" ? args.reason : "", ctx);
    case "createStudentNote": return createStudentNote(id(args), input(args), ctx);
    case "updateStudentNote": return updateStudentNote(id(args), input(args), ctx);
    default: throw new NotFoundError(`unsupported academics GraphQL field: ${event.info.fieldName}`);
  }
}

export async function handler(event: Event): Promise<unknown> {
  try {
    await hydrateAcademicsRuntimeConfig();
    return await handleAcademicsGraphql(event);
  } catch (error) {
    const candidate = error as { name?: string; message?: string; details?: unknown };
    console.error("academics GraphQL operation failed", {
      fieldName: event.info.fieldName,
      errorName: candidate.name,
      message: candidate.message,
      details: candidate.details,
    });
    throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]);
  }
}
