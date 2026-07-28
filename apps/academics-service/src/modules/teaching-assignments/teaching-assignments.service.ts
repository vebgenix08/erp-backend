import type { RequestContext } from "@school-erp/api";
import type { Permission } from "@school-erp/auth";
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from "@school-erp/errors";
import { academicsPermissions } from "../../permissions";
import type { TeachingAssignmentFilter, TeachingAssignmentInput, TeachingAssignmentRole } from "./teaching-assignments.model";
import { teachingAssignmentRepository, type TeachingAssignmentRepository } from "./teaching-assignments.repository";

export interface TeachingAssignmentDeps { repository?: TeachingAssignmentRepository | Promise<TeachingAssignmentRepository> }
const required = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new ValidationError([{ field, message: `${field} is required` }]); return value.trim(); };
const tenant = (context: RequestContext) => required(context.tenantContext?.tenantId, "tenantId");
const actor = (context: RequestContext) => required(context.authContext?.user?.id, "userId");
const permit = (context: RequestContext, permission: Permission) => { if (!(context.authContext?.user?.permissions ?? []).includes(permission)) throw new ForbiddenError(`permission ${permission} is required`); };
const repo = async (deps?: TeachingAssignmentDeps) => await (deps?.repository ?? teachingAssignmentRepository());
const view = (record: Awaited<ReturnType<TeachingAssignmentRepository["create"]>>) => ({ ...record, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), deactivatedAt: record.deactivatedAt?.toISOString() });
function validateInput(input: unknown): TeachingAssignmentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("input is required");
  const value = input as Record<string, unknown>; const role = required(value.role, "role") as TeachingAssignmentRole;
  if (!["SUBJECT_TEACHER", "SECTION_INCHARGE"].includes(role)) throw new BadRequestError("role is invalid");
  const subjectId = typeof value.subjectId === "string" && value.subjectId.trim() ? value.subjectId.trim() : undefined;
  if (role === "SUBJECT_TEACHER" && !subjectId) throw new BadRequestError("subjectId is required for a subject teacher");
  return { campusId: required(value.campusId, "campusId"), academicYearId: required(value.academicYearId, "academicYearId"), employeeId: required(value.employeeId, "employeeId"), employeeName: required(value.employeeName, "employeeName"), role, programId: required(value.programId, "programId"), classId: required(value.classId, "classId"), sectionId: required(value.sectionId, "sectionId"), ...(subjectId ? { subjectId } : {}) };
}
export async function listTeachingAssignments(context: RequestContext, filter: unknown, deps?: TeachingAssignmentDeps) {
  permit(context, academicsPermissions.teachingAssignments.read as Permission);
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) throw new BadRequestError("filter is required");
  const value = filter as Record<string, unknown>; const parsed: TeachingAssignmentFilter = { campusId: required(value.campusId, "campusId") };
  for (const field of ["academicYearId", "employeeId", "classId", "sectionId", "subjectId", "role", "status"] as const) if (typeof value[field] === "string" && value[field].trim()) Object.assign(parsed, { [field]: value[field].trim() });
  return (await (await repo(deps)).list(tenant(context), parsed)).map(view);
}
export async function createTeachingAssignment(input: unknown, context: RequestContext, deps?: TeachingAssignmentDeps) {
  permit(context, academicsPermissions.teachingAssignments.manage as Permission);
  return view(await (await repo(deps)).create(tenant(context), actor(context), validateInput(input)));
}
export async function deactivateTeachingAssignment(id: string, context: RequestContext, deps?: TeachingAssignmentDeps) {
  permit(context, academicsPermissions.teachingAssignments.manage as Permission);
  const record = await (await repo(deps)).deactivate(tenant(context), required(id, "id"));
  if (!record) throw new NotFoundError("teaching assignment not found"); return view(record);
}
