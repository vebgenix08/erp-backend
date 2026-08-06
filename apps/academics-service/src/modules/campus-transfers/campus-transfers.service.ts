import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { ConflictError, ForbiddenError, NotFoundError } from "@school-erp/errors";
import { issueConfiguredNumber, type NumberingContext } from "@school-erp/numbering";
import { classRepository, type ClassRepository } from "../classes/classes.repository";
import { programRepository, type ProgramRepository } from "../programs/programs.repository";
import { sectionRepository, type SectionRepository } from "../sections/sections.repository";
import { studentRepository, type StudentRepository } from "../students/students.repository";
import type { CampusTransferPageFilter, CampusTransferRecord, CampusTransferStatus } from "./campus-transfers.model";
import { campusTransferPermissions } from "./campus-transfers.permissions";
import { campusTransferRepository, type CampusTransferRepository } from "./campus-transfers.repository";
import { validateCreateCampusTransfer } from "./campus-transfers.validator";

export interface CampusTransferOrchestrator {
  start(input: { transferId: string; tenantId: string; financeApproved: boolean }): Promise<{ executionArn: string }>;
}
export interface Dependencies {
  repository?: CampusTransferRepository | Promise<CampusTransferRepository>;
  students?: StudentRepository | Promise<StudentRepository>;
  classes?: ClassRepository | Promise<ClassRepository>;
  sections?: SectionRepository | Promise<SectionRepository>;
  programs?: ProgramRepository | Promise<ProgramRepository>;
  orchestrator?: CampusTransferOrchestrator;
  now?: () => Date;
  numberIssuer?: (input: NumberingContext) => Promise<string>;
}

async function resolve<T>(value: T | Promise<T> | undefined, fallback: () => T | Promise<T>): Promise<T> {
  return await (value ?? fallback());
}
function tenant(context: RequestContext): string {
  const id = context.tenantContext?.tenantId?.trim();
  if (!id) throw new ForbiddenError("tenant context is required");
  return id;
}
function actor(context: RequestContext): string {
  const id = context.authContext?.user?.id?.trim();
  if (!id) throw new ForbiddenError("authenticated user is required");
  return id;
}
function permission(context: RequestContext, required: string): void {
  if (!(context.authContext?.user?.permissions ?? []).includes(required as Permission)) {
    throw new ForbiddenError(`permission ${required} is required`);
  }
}
function view(record: CampusTransferRecord) {
  return {
    ...record,
    effectiveAt: record.effectiveAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    history: record.history.map((item) => ({ ...item, at: item.at.toISOString() })),
  };
}
async function issueUniqueRegistrationNumber(students: StudentRepository, issue: (input: NumberingContext) => Promise<string>, context: Omit<NumberingContext, "stream" | "idempotencyKey">, key: string, studentId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await issue({ ...context, stream: "STUDENT_REGISTRATION", idempotencyKey: `${key}:${attempt}` });
    if (!await students.registrationNumberExists(context.tenantId, value, studentId)) return value;
  }
  throw new ConflictError("unable to reserve a unique student registration number");
}
async function issueUniqueRollNumber(students: StudentRepository, issue: (input: NumberingContext) => Promise<string>, context: Omit<NumberingContext, "stream" | "idempotencyKey"> & { academicYearId: string; sectionId: string }, key: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await issue({ ...context, stream: "ROLL_NUMBER", idempotencyKey: `${key}:${attempt}` });
    if (!await students.rollNumberExists(context.tenantId, context.academicYearId, context.sectionId, value)) return value;
  }
  throw new ConflictError("unable to reserve a unique section roll number");
}

export async function createCampusTransfer(input: unknown, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.create);
  const tenantId = tenant(context);
  const userId = actor(context);
  const payload = validateCreateCampusTransfer(input);
  const repository = await resolve(deps.repository, campusTransferRepository);
  const retry = await repository.getByRequestId(tenantId, payload.clientRequestId);
  if (retry) return view(retry);
  if (await repository.getActiveByStudent(tenantId, payload.studentId)) {
    throw new ConflictError("another campus transfer is already active for this student");
  }
  const students = await resolve(deps.students, studentRepository);
  const student = await students.getById(tenantId, payload.studentId);
  if (!student || student.student.status !== "ACTIVE") throw new NotFoundError("active student was not found");
  if (student.enrollment.campusId === payload.targetCampusId) {
    throw new ConflictError("same-campus placement changes do not require a campus transfer");
  }
  const classes = await resolve(deps.classes, () => classRepository);
  const targetClass = await classes.getById(tenantId, payload.targetClassId);
  if (!targetClass || targetClass.status !== "ACTIVE" || targetClass.campusId !== payload.targetCampusId) {
    throw new NotFoundError("active target class was not found in the target campus");
  }
  if (payload.targetSectionId) {
    const sections = await resolve(deps.sections, () => sectionRepository);
    const section = await sections.getById(tenantId, payload.targetSectionId);
    if (!section || section.status !== "ACTIVE" || section.classId !== targetClass.id || section.campusId !== payload.targetCampusId) {
      throw new NotFoundError("active target section was not found in the target class");
    }
  }
  const programs = await resolve(deps.programs, () => programRepository);
  const [sourceProgram, targetProgram] = await Promise.all([
    programs.getById(tenantId, student.enrollment.programId),
    programs.getById(tenantId, targetClass.programId),
  ]);
  const registrationAction = sourceProgram && targetProgram &&
    sourceProgram.academicUnitId === targetProgram.academicUnitId &&
    sourceProgram.name.trim().toLowerCase() === targetProgram.name.trim().toLowerCase()
    ? "KEEP" as const : "REGENERATE" as const;
  const now = deps.now?.() ?? new Date();
  const id = `campus_transfer_${crypto.randomUUID()}`;
  const issue = deps.numberIssuer ?? issueConfiguredNumber;
  const numberingContext = { tenantId, campusId: payload.targetCampusId, academicYearId: payload.academicYearId, programId: targetClass.programId, classId: targetClass.id, classCode: targetClass.code };
  const targetRegistrationNumber = registrationAction === "KEEP"
    ? student.student.registrationNumber
    : await issueUniqueRegistrationNumber(students, issue, numberingContext, `campus-transfer-registration:${id}`, student.student.id);
  const targetRollNumber = payload.targetSectionId
    ? await issueUniqueRollNumber(students, issue, { ...numberingContext, academicYearId: payload.academicYearId, sectionId: payload.targetSectionId }, `campus-transfer-roll:${id}`)
    : undefined;
  const record: CampusTransferRecord = {
    id,
    tenantId,
    studentId: student.student.id,
    studentName: student.student.name,
    admissionApplicationId: student.student.admissionApplicationId,
    registrationNumber: student.student.registrationNumber,
    targetRegistrationNumber,
    clientRequestId: payload.clientRequestId,
    source: {
      campusId: student.enrollment.campusId,
      academicYearId: student.enrollment.academicYearId,
      programId: student.enrollment.programId,
      classId: student.enrollment.classId,
      enrollmentId: student.enrollment.id,
      ...(student.enrollment.sectionId ? { sectionId: student.enrollment.sectionId } : {}),
    },
    target: {
      campusId: payload.targetCampusId,
      academicYearId: payload.academicYearId,
      programId: targetClass.programId,
      classId: targetClass.id,
      enrollmentId: `enrollment_${crypto.randomUUID()}`,
      ...(payload.targetSectionId ? { sectionId: payload.targetSectionId } : {}),
      ...(targetRollNumber ? { rollNumber: targetRollNumber } : {}),
    },
    effectiveAt: new Date(payload.effectiveAt),
    reason: payload.reason,
    ...(payload.note ? { note: payload.note } : {}),
    status: "DRAFT",
    registrationAction,
    requestedBy: userId,
    createdAt: now,
    updatedAt: now,
    history: [{ status: "DRAFT", at: now, actorId: userId, note: "Campus transfer requested" }],
  };
  const created = await repository.create(record);
  if (!deps.orchestrator) throw new Error("campus transfer orchestrator is not configured");
  try {
    const execution = await deps.orchestrator.start({ transferId: id, tenantId, financeApproved: false });
    const processing = await repository.update(tenantId, id, {
      status: "PROCESSING",
      executionArn: execution.executionArn,
      updatedAt: now,
      history: [...created.history, { status: "PROCESSING", at: now, actorId: userId, note: "Workflow started" }],
    }, ["DRAFT"]);
    return view(processing);
  } catch (error) {
    await repository.update(tenantId, id, {
      status: "FAILED",
      failureReason: error instanceof Error ? error.message : "workflow start failed",
      updatedAt: now,
      history: [...created.history, { status: "FAILED", at: now, actorId: userId, note: "Workflow could not start" }],
    }, ["DRAFT"]);
    throw error;
  }
}

export async function listCampusTransfers(studentId: string, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.read);
  return (await (await resolve(deps.repository, campusTransferRepository)).listByStudent(tenant(context), studentId)).map(view);
}
export async function listCampusTransferPage(filter: CampusTransferPageFilter, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.read);
  const page = await (await resolve(deps.repository, campusTransferRepository)).listPage(tenant(context), filter);
  return { ...page, items: page.items.map(view) };
}
export async function getCampusTransfer(id: string, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.read);
  const value = await (await resolve(deps.repository, campusTransferRepository)).getById(tenant(context), id);
  if (!value) throw new NotFoundError("campus transfer was not found");
  return view(value);
}
export async function approveCampusTransfer(id: string, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.review);
  const tenantId = tenant(context), userId = actor(context), repository = await resolve(deps.repository, campusTransferRepository);
  if (!deps.orchestrator) throw new Error("campus transfer orchestrator is not configured");
  const current = await repository.getById(tenantId, id);
  if (!current) throw new NotFoundError("campus transfer was not found");
  if (current.status !== "UNDER_REVIEW") throw new ConflictError("only a transfer under review can be approved");
  const now = deps.now?.() ?? new Date();
  const processing = await repository.update(tenantId, id, { status:"PROCESSING",reviewedBy:userId,warning:undefined,failureReason:undefined,updatedAt:now,history:[...current.history,{status:"PROCESSING",at:now,actorId:userId,note:"Finance review approved"}] }, ["UNDER_REVIEW"]);
  try {
    const execution = await deps.orchestrator.start({ transferId:id,tenantId,financeApproved:true });
    return view(await repository.update(tenantId,id,{executionArn:execution.executionArn,updatedAt:now},["PROCESSING"]));
  } catch (error) {
    const message=error instanceof Error?error.message:"workflow restart failed";
    await repository.update(tenantId,id,{status:"UNDER_REVIEW",failureReason:message,updatedAt:now,history:[...processing.history,{status:"UNDER_REVIEW",at:now,actorId:userId,note:"Workflow restart failed"}]},["PROCESSING"]);
    throw error;
  }
}
export async function retryCampusTransfer(id: string, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.review);
  const tenantId = tenant(context), userId = actor(context), repository = await resolve(deps.repository, campusTransferRepository);
  if (!deps.orchestrator) throw new Error("campus transfer orchestrator is not configured");
  const current = await repository.getById(tenantId, id);
  if (!current) throw new NotFoundError("campus transfer was not found");
  if (current.status !== "FAILED") throw new ConflictError("only a failed campus transfer can be retried");
  const now = deps.now?.() ?? new Date();
  const processing = await repository.update(tenantId, id, {
    status: "PROCESSING",
    failureReason: undefined,
    warning: undefined,
    updatedAt: now,
    history: [...current.history, { status: "PROCESSING", at: now, actorId: userId, note: "Workflow retry requested" }],
  }, ["FAILED"]);
  try {
    const execution = await deps.orchestrator.start({ transferId: id, tenantId, financeApproved: false });
    return view(await repository.update(tenantId, id, { executionArn: execution.executionArn, updatedAt: now }, ["PROCESSING"]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "workflow retry failed";
    return view(await repository.update(tenantId, id, {
      status: "FAILED",
      failureReason: message,
      updatedAt: now,
      history: [...processing.history, { status: "FAILED", at: now, actorId: userId, note: "Workflow retry could not start" }],
    }, ["PROCESSING"]));
  }
}
export async function cancelCampusTransfer(id: string, reason: string, context: RequestContext, deps: Dependencies = {}) {
  permission(context, campusTransferPermissions.cancel);
  if (!reason.trim()) throw new ConflictError("cancellation reason is required");
  const tenantId=tenant(context),userId=actor(context),repository=await resolve(deps.repository,campusTransferRepository),current=await repository.getById(tenantId,id);
  if(!current)throw new NotFoundError("campus transfer was not found");
  const now=deps.now?.()??new Date();
  return view(await repository.update(tenantId,id,{status:"CANCELLED",failureReason:undefined,updatedAt:now,history:[...current.history,{status:"CANCELLED",at:now,actorId:userId,note:reason.trim()}]},["DRAFT","UNDER_REVIEW","FAILED"]));
}
export async function updateCampusTransferWorkflow(tenantId: string, id: string, status: CampusTransferStatus, input: Partial<CampusTransferRecord>, deps: Dependencies = {}) {
  const repository = await resolve(deps.repository, campusTransferRepository);
  const current = await repository.getById(tenantId, id);
  if (!current) throw new NotFoundError("campus transfer was not found");
  const now = deps.now?.() ?? new Date();
  return repository.update(tenantId, id, {
    ...input,
    status,
    updatedAt: now,
    history: [...current.history, { status, at: now, actorId: "SYSTEM", ...(input.failureReason ? { note: input.failureReason } : {}) }],
    ...(status === "COMPLETED" ? { completedAt: now } : {}),
  }, ["PROCESSING", "UNDER_REVIEW"]);
}
export async function commitCampusTransfer(tenantId: string, id: string, financeAssessment?: Record<string, unknown>, deps: Dependencies = {}) {
  const repository = await resolve(deps.repository, campusTransferRepository);
  let record = await repository.getById(tenantId, id);
  if (!record) throw new NotFoundError("campus transfer was not found");
  if (record.status === "COMPLETED") return view(record);
  const students = await resolve(deps.students, studentRepository);
  const current = await students.getById(tenantId, record.studentId);
  if (!current) throw new NotFoundError("student was not found");
  if (record.registrationAction === "REGENERATE" && await students.registrationNumberExists(tenantId, record.targetRegistrationNumber, record.studentId)) {
    const targetClass = await (await resolve(deps.classes, () => classRepository)).getById(tenantId, record.target.classId);
    if (!targetClass) throw new NotFoundError("target class was not found");
    const replacement = await issueUniqueRegistrationNumber(students, deps.numberIssuer ?? issueConfiguredNumber, {
      tenantId,
      campusId: record.target.campusId,
      academicYearId: record.target.academicYearId,
      programId: record.target.programId,
      classId: record.target.classId,
      classCode: targetClass.code,
    }, `campus-transfer-registration:${id}:recovery`, record.studentId);
    const now = deps.now?.() ?? new Date();
    record = await repository.update(tenantId, id, {
      targetRegistrationNumber: replacement,
      updatedAt: now,
      history: [...record.history, { status: record.status, at: now, actorId: "SYSTEM", note: "Registration number reallocated after uniqueness reconciliation" }],
    }, [record.status]);
  }
  const workflowUpdate = financeAssessment ? { financeAssessment } : {};
  if (current.enrollment.id === record.target.enrollmentId) {
    if (record.registrationAction === "REGENERATE" && current.student.registrationNumber !== record.targetRegistrationNumber) await students.setRegistrationNumber(tenantId, record.studentId, record.targetRegistrationNumber);
    return view(await updateCampusTransferWorkflow(tenantId, id, "COMPLETED", workflowUpdate, deps));
  }
  if (current.enrollment.id !== record.source.enrollmentId) {
    throw new ConflictError("student enrollment changed after the transfer request");
  }
  await students.changeEnrollment(tenantId, record.studentId, {
    enrollmentId: record.target.enrollmentId,
    campusId: record.target.campusId,
    academicYearId: record.target.academicYearId,
    programId: record.target.programId,
    classId: record.target.classId,
    ...(record.target.sectionId ? { sectionId: record.target.sectionId } : {}),
    ...(record.target.rollNumber ? { rollNumber: record.target.rollNumber } : {}),
    ...(record.registrationAction === "REGENERATE" ? { registrationNumber: record.targetRegistrationNumber } : {}),
    changedBy: record.requestedBy,
  });
  return view(await updateCampusTransferWorkflow(tenantId, id, "COMPLETED", workflowUpdate, deps));
}
