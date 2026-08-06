import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { createRuntimeEventPublisher, type EventPublisher, type StudentEnrollmentChangedEvent } from "@school-erp/events";
import { BadRequestError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { issueConfiguredNumber, type NumberingContext } from "@school-erp/numbering";
import { classRepository, type ClassRepository } from "../classes/classes.repository";
import { sectionRepository, type SectionRepository } from "../sections/sections.repository";
import { toStudentView } from "./students.mapper";
import { studentPermissions } from "./students.permissions";
import { studentRepository, type StudentRepository } from "./students.repository";
import { validateChangeStudentEnrollment, validateClassRegistrationNumbering, validateCreateStudentFromAdmission, validateSectionRollNumbering, validateStudentFilter } from "./students.validator";

export interface StudentServiceDependencies {
  repository?: StudentRepository | Promise<StudentRepository>;
  classes?: ClassRepository | Promise<ClassRepository>;
  sections?: SectionRepository | Promise<SectionRepository>;
  publisher?: EventPublisher;
  numberIssuer?: (context: NumberingContext) => Promise<string>;
}
const repo = async (deps?: StudentServiceDependencies) => await (deps?.repository ?? studentRepository());
const classes = async (deps?: StudentServiceDependencies) => await (deps?.classes ?? classRepository);
const sections = async (deps?: StudentServiceDependencies) => await (deps?.sections ?? sectionRepository);
const tenantId = (context: RequestContext) => { const value = context.tenantContext?.tenantId?.trim(); if (!value) throw new BadRequestError("tenantId is required"); return value; };
const actorId = (context: RequestContext) => { const value = context.authContext?.user?.id?.trim(); if (!value) throw new ForbiddenError("authenticated user is required"); return value; };
const permission = (context: RequestContext, required: Permission) => { if (!(context.authContext?.user?.permissions ?? []).includes(required)) throw new ForbiddenError(`permission ${required} is required`); };

export async function createStudentFromAdmission(input: unknown, eventTenantId: string, deps?: StudentServiceDependencies) {
  const payload = validateCreateStudentFromAdmission(input), tid = eventTenantId.trim();
  if (!tid) throw new BadRequestError("tenantId is required");
  const repository = await repo(deps);
  const existing = await repository.getByAdmissionApplicationId(tid, payload.admissionApplicationId);
  if (existing) return toStudentView(existing);
  const academicClass = await (await classes(deps)).getById(tid, payload.classId);
  if (!academicClass || academicClass.status !== "ACTIVE") throw new NotFoundError("active academic class was not found");
  if (academicClass.campusId !== payload.campusId) throw new BadRequestError("academic class does not belong to the admission campus");
  const studentId = `student_${crypto.randomUUID()}`;
  const enrollmentId = `enrollment_${crypto.randomUUID()}`;
  const issue = deps?.numberIssuer ?? (!deps?.repository ? issueConfiguredNumber : undefined);
  const registrationNumber = issue
    ? await issue({
        tenantId: tid,
        stream: "STUDENT_REGISTRATION",
        idempotencyKey: `registration:${payload.admissionApplicationId}`,
        campusId: payload.campusId,
        academicYearId: payload.academicYearId,
        programId: academicClass.programId,
        classId: payload.classId,
        classCode: academicClass.code,
      })
    : undefined;
  const rollNumber = payload.sectionId && issue
    ? await issue({
        tenantId: tid,
        stream: "ROLL_NUMBER",
        idempotencyKey: `section-assignment:${enrollmentId}`,
        campusId: payload.campusId,
        academicYearId: payload.academicYearId,
        programId: academicClass.programId,
        classId: payload.classId,
        classCode: academicClass.code,
        sectionId: payload.sectionId,
      })
    : undefined;
  return toStudentView(await repository.createFromAdmission(tid, {
    ...payload,
    studentId,
    enrollmentId,
    ...(registrationNumber ? { registrationNumber } : {}),
    ...(rollNumber ? { rollNumber } : {}),
  }, academicClass.programId));
}
export async function listStudents(context: RequestContext, filter?: unknown, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.read as Permission);
  return (await (await repo(deps)).list(tenantId(context), validateStudentFilter(filter))).map(toStudentView);
}
export async function listStudentPage(context: RequestContext, filter?: unknown, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.read as Permission);
  const result = await (await repo(deps)).listPage(
    tenantId(context),
    validateStudentFilter(filter),
  );
  return { ...result, items: result.items.map(toStudentView) };
}
export async function getStudent(id: string, context: RequestContext, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.read as Permission);
  const value = await (await repo(deps)).getById(tenantId(context), id.trim());
  if (!value) throw new NotFoundError("student was not found");
  return toStudentView(value);
}
export async function getStudentByAdmissionApplicationId(applicationId: string, context: RequestContext, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.read as Permission);
  const value = await (await repo(deps)).getByAdmissionApplicationId(
    tenantId(context),
    applicationId.trim(),
  );
  if (!value) throw new NotFoundError("student was not created for this admission");
  return toStudentView(value);
}
export async function changeStudentEnrollment(id: string, input: unknown, context: RequestContext, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.enroll as Permission);
  const tid = tenantId(context), payload = validateChangeStudentEnrollment(input);
  const academicClass = await (await classes(deps)).getById(tid, payload.classId);
  if (!academicClass || academicClass.status !== "ACTIVE") throw new NotFoundError("active academic class was not found");
  if (academicClass.campusId !== payload.campusId) throw new BadRequestError("academic class does not belong to the selected campus");
  if (payload.sectionId) {
    const section = await (await sections(deps)).getById(tid, payload.sectionId);
    if (!section || section.status !== "ACTIVE" || section.classId !== payload.classId) throw new BadRequestError("section does not belong to the selected class");
  }
  const enrollmentId = `enrollment_${crypto.randomUUID()}`;
  const issue = deps?.numberIssuer ?? (!deps?.repository ? issueConfiguredNumber : undefined);
  const generatedRollNumber = payload.sectionId && issue
    ? await issue({
        tenantId: tid,
        stream: "ROLL_NUMBER",
        idempotencyKey: `section-assignment:${enrollmentId}`,
        campusId: payload.campusId,
        academicYearId: payload.academicYearId,
        programId: academicClass.programId,
        classId: payload.classId,
        classCode: academicClass.code,
        sectionId: payload.sectionId,
      })
    : undefined;
  const changed = await (await repo(deps)).changeEnrollment(tid, id.trim(), {
    ...payload,
    enrollmentId,
    ...(generatedRollNumber ? { rollNumber: generatedRollNumber } : {}),
    programId: academicClass.programId,
    changedBy: actorId(context),
  });
  const view = toStudentView(changed.current);
  const event: StudentEnrollmentChangedEvent = { id: `student-enrollment-changed-${view.enrollment.id}`, type: "academics.student.enrollment-changed.v1", source: "erp.academics", tenantId: tid, occurredAt: view.enrollment.enrolledAt, correlationId: context.requestId, data: { admissionApplicationId: view.admissionApplicationId, studentId: view.id, studentName: view.name, registrationNumber: view.registrationNumber, previousEnrollmentId: changed.previousEnrollmentId, enrollmentId: view.enrollment.id, campusId: view.enrollment.campusId, academicYearId: view.enrollment.academicYearId, programId: view.enrollment.programId, classId: view.enrollment.classId, ...(view.enrollment.sectionId ? { sectionId: view.enrollment.sectionId } : {}), enrolledAt: view.enrollment.enrolledAt, createdBy: actorId(context), reason: payload.reason } };
  await (deps?.publisher ?? createRuntimeEventPublisher("erp.academics")).publish(event);
  return view;
}

export async function generateClassRegistrationNumbers(input: unknown, context: RequestContext, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.enroll as Permission);
  const tid = tenantId(context);
  const payload = validateClassRegistrationNumbering(input);
  const academicClass = await (await classes(deps)).getById(tid, payload.classId);
  if (!academicClass || academicClass.status !== "ACTIVE") throw new NotFoundError("active academic class was not found");
  if (academicClass.campusId !== payload.campusId) throw new BadRequestError("academic class does not belong to the selected campus");
  const repository = await repo(deps);
  const rows = await repository.list(tid, {
    campusId: payload.campusId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    status: "ACTIVE",
    limit: 10_000,
  });
  const issue = deps?.numberIssuer ?? (!deps?.repository ? issueConfiguredNumber : undefined);
  if (!issue) return { updated: 0, skipped: rows.length, students: rows.map(toStudentView) };
  let updated = 0;
  let skipped = 0;
  for (const row of rows.sort((left, right) => left.student.name.localeCompare(right.student.name) || left.student.id.localeCompare(right.student.id))) {
    if (row.student.registrationNumber.trim()) {
      skipped += 1;
      continue;
    }
    const registrationNumber = await issue({
      tenantId: tid,
      stream: "STUDENT_REGISTRATION",
      idempotencyKey: `class-registration:${payload.clientRequestId}:${row.student.id}`,
      campusId: payload.campusId,
      academicYearId: payload.academicYearId,
      programId: academicClass.programId,
      classId: academicClass.id,
      classCode: academicClass.code,
    });
    await repository.setRegistrationNumber(tid, row.student.id, registrationNumber);
    updated += 1;
  }
  const students = await repository.list(tid, {
    campusId: payload.campusId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    status: "ACTIVE",
    limit: 10_000,
  });
  return { updated, skipped, students: students.map(toStudentView) };
}

export async function generateSectionRollNumbers(input: unknown, context: RequestContext, deps?: StudentServiceDependencies) {
  permission(context, studentPermissions.enroll as Permission);
  const tid = tenantId(context);
  const payload = validateSectionRollNumbering(input);
  const academicClass = await (await classes(deps)).getById(tid, payload.classId);
  if (!academicClass || academicClass.status !== "ACTIVE") throw new NotFoundError("active academic class was not found");
  if (academicClass.campusId !== payload.campusId) throw new BadRequestError("academic class does not belong to the selected campus");
  const section = await (await sections(deps)).getById(tid, payload.sectionId);
  if (!section || section.status !== "ACTIVE" || section.classId !== payload.classId || section.campusId !== payload.campusId)
    throw new BadRequestError("section does not belong to the selected class and campus");
  const repository = await repo(deps);
  const rows = await repository.list(tid, {
    campusId: payload.campusId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    status: "ACTIVE",
    limit: 10_000,
  });
  const issue = deps?.numberIssuer ?? (!deps?.repository ? issueConfiguredNumber : undefined);
  if (!issue) return { updated: 0, skipped: rows.length, students: rows.map(toStudentView) };
  let updated = 0;
  let skipped = 0;
  for (const row of rows.sort((left, right) => left.student.name.localeCompare(right.student.name) || left.student.id.localeCompare(right.student.id))) {
    if (!payload.regenerate && row.enrollment.rollNumber?.trim()) {
      skipped += 1;
      continue;
    }
    const rollNumber = await issue({
      tenantId: tid,
      stream: "ROLL_NUMBER",
      idempotencyKey: payload.regenerate
        ? `section-roll-regeneration:${payload.clientRequestId}:${row.enrollment.id}`
        : `section-assignment:${row.enrollment.id}`,
      campusId: payload.campusId,
      academicYearId: payload.academicYearId,
      programId: academicClass.programId,
      classId: academicClass.id,
      classCode: academicClass.code,
      sectionId: payload.sectionId,
    });
    await repository.setEnrollmentRollNumber(tid, row.enrollment.id, rollNumber);
    updated += 1;
  }
  const students = await repository.list(tid, {
    campusId: payload.campusId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    status: "ACTIVE",
    limit: 10_000,
  });
  return { updated, skipped, students: students.map(toStudentView) };
}
