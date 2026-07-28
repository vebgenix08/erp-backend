import type { RequestContext } from "@school-erp/api";
import type { ProgramServiceDeps } from "./programs.shared";
import { createProgramUseCase } from "./use-cases/create-program.use-case";
import { getProgramUseCase } from "./use-cases/get-program.use-case";
import { listProgramsUseCase } from "./use-cases/list-programs.use-case";
import { updateProgramUseCase } from "./use-cases/update-program.use-case";
import { deactivateProgramUseCase } from "./use-cases/deactivate-program.use-case";

export type { ProgramServiceDeps } from "./programs.shared";

export async function createProgram(input: unknown, context: RequestContext, deps?: ProgramServiceDeps) {
  return createProgramUseCase(input, context, deps);
}

export async function getProgram(id: string, context: RequestContext, deps?: ProgramServiceDeps) {
  return getProgramUseCase(id, context, deps);
}

export async function listPrograms(context: RequestContext, deps?: ProgramServiceDeps, filter?: unknown) {
  return listProgramsUseCase(context, deps, filter);
}

export async function updateProgram(id: string, input: unknown, context: RequestContext, deps?: ProgramServiceDeps) {
  return updateProgramUseCase(id, input, context, deps);
}

export async function deactivateProgram(id: string, context: RequestContext, deps?: ProgramServiceDeps) {
  return deactivateProgramUseCase(id, context, deps);
}
