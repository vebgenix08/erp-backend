import type { RequestContext } from "@school-erp/api";
import { normalizePermissions } from "@school-erp/auth";
import { ForbiddenError, NotFoundError, ValidationError, toGraphqlError } from "@school-erp/errors";
import { academicsPermissions } from "../permissions";
import { createProgram, deactivateProgram, listPrograms, updateProgram } from "../modules/programs/programs.service";
import { createClass, deactivateClass, listClasses, updateClass } from "../modules/classes/classes.service";
import { createSection, deactivateSection, listSections, updateSection } from "../modules/sections/sections.service";
import { createSubject, deactivateSubject, listSubjects, updateSubject } from "../modules/subjects/subjects.service";
import { changeStudentEnrollment, getStudent, getStudentByAdmissionApplicationId, listStudentPage, listStudents } from "../modules/students/students.service";
import { hydrateAcademicsRuntimeConfig } from "./runtime-config";
import { createTeachingAssignment, deactivateTeachingAssignment, listTeachingAssignments } from "../modules/teaching-assignments/teaching-assignments.service";
import { getStudentDocument, issueStudentDocument, listStudentDocuments, revokeStudentDocument } from "../modules/student-documents/student-documents.service";
import { createStudentNote, listStudentNotes, updateStudentNote } from "../modules/student-notes/student-notes.service";

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

export async function handleAcademicsGraphql(event: Event): Promise<unknown> {
  const ctx = context(event); const args = event.arguments ?? {};
  switch (event.info.fieldName) {
    case "academicPrograms": return listPrograms(ctx, undefined, filter(args));
    case "academicClasses": return listClasses(ctx, undefined, filter(args));
    case "academicSections": return listSections(ctx, undefined, filter(args));
    case "academicSubjects": return listSubjects(ctx, undefined, filter(args));
    case "teachingAssignments": return listTeachingAssignments(ctx, filter(args));
    case "students": return listStudents(ctx, filter(args));
    case "studentPage": return listStudentPage(ctx, filter(args));
    case "student": return getStudent(id(args), ctx);
    case "studentByAdmissionApplicationId": return getStudentByAdmissionApplicationId(id(args), ctx);
    case "studentDocuments": return listStudentDocuments(filter(args), ctx);
    case "studentDocument": return getStudentDocument(id(args), ctx);
    case "studentNotes": return listStudentNotes(id(args), ctx);
    case "changeStudentEnrollment": return changeStudentEnrollment(id(args), input(args), ctx);
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
    case "createTeachingAssignment": return createTeachingAssignment(input(args), ctx);
    case "deactivateTeachingAssignment": return deactivateTeachingAssignment(id(args), ctx);
    case "issueStudentDocument": return issueStudentDocument(input(args), ctx);
    case "revokeStudentDocument": return revokeStudentDocument(id(args), typeof args.reason === "string" ? args.reason : "", ctx);
    case "createStudentNote": return createStudentNote(id(args), input(args), ctx);
    case "updateStudentNote": return updateStudentNote(id(args), input(args), ctx);
    default: throw new NotFoundError(`unsupported academics GraphQL field: ${event.info.fieldName}`);
  }
}

export async function handler(event: Event): Promise<unknown> { try { await hydrateAcademicsRuntimeConfig(); return await handleAcademicsGraphql(event); } catch (error) { throw toGraphqlError(error, event.request?.headers?.["x-amzn-trace-id"]); } }
