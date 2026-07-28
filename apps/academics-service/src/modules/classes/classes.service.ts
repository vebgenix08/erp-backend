import type { RequestContext } from "@school-erp/api";
import type { ClassServiceDeps } from "./classes.shared";
import { createClassUseCase } from "./use-cases/create-class.use-case";
import { getClassUseCase } from "./use-cases/get-class.use-case";
import { listClassesUseCase } from "./use-cases/list-classes.use-case";
import { updateClassUseCase } from "./use-cases/update-class.use-case";
import { deactivateClassUseCase } from "./use-cases/deactivate-class.use-case";

export type { ClassServiceDeps } from "./classes.shared";

export async function createClass(input: unknown, context: RequestContext, deps?: ClassServiceDeps) {
  return createClassUseCase(input, context, deps);
}

export async function getClass(id: string, context: RequestContext, deps?: ClassServiceDeps) {
  return getClassUseCase(id, context, deps);
}

export async function listClasses(context: RequestContext, deps?: ClassServiceDeps, filter?: unknown) {
  return listClassesUseCase(context, deps, filter);
}

export async function updateClass(id: string, input: unknown, context: RequestContext, deps?: ClassServiceDeps) {
  return updateClassUseCase(id, input, context, deps);
}

export async function deactivateClass(id: string, context: RequestContext, deps?: ClassServiceDeps) {
  return deactivateClassUseCase(id, context, deps);
}
