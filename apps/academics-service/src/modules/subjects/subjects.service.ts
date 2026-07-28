import type { RequestContext } from "@school-erp/api";
import type { SubjectServiceDeps } from "./subjects.shared";
import { createSubjectUseCase } from "./use-cases/create-subject.use-case";
import { getSubjectUseCase } from "./use-cases/get-subject.use-case";
import { listSubjectsUseCase } from "./use-cases/list-subjects.use-case";
import { updateSubjectUseCase } from "./use-cases/update-subject.use-case";
import { deactivateSubjectUseCase } from "./use-cases/deactivate-subject.use-case";

export type { SubjectServiceDeps } from "./subjects.shared";

export async function createSubject(input: unknown, context: RequestContext, deps?: SubjectServiceDeps) {
  return createSubjectUseCase(input, context, deps);
}

export async function getSubject(id: string, context: RequestContext, deps?: SubjectServiceDeps) {
  return getSubjectUseCase(id, context, deps);
}

export async function listSubjects(context: RequestContext, deps?: SubjectServiceDeps, filter?: unknown) {
  return listSubjectsUseCase(context, deps, filter);
}

export async function updateSubject(id: string, input: unknown, context: RequestContext, deps?: SubjectServiceDeps) {
  return updateSubjectUseCase(id, input, context, deps);
}

export async function deactivateSubject(id: string, context: RequestContext, deps?: SubjectServiceDeps) {
  return deactivateSubjectUseCase(id, context, deps);
}
