import type { RequestContext } from "@school-erp/api";
import type { SectionServiceDeps } from "./sections.shared";
import { createSectionUseCase } from "./use-cases/create-section.use-case";
import { getSectionUseCase } from "./use-cases/get-section.use-case";
import { listSectionsUseCase } from "./use-cases/list-sections.use-case";
import { updateSectionUseCase } from "./use-cases/update-section.use-case";
import { deactivateSectionUseCase } from "./use-cases/deactivate-section.use-case";

export type { SectionServiceDeps } from "./sections.shared";

export async function createSection(input: unknown, context: RequestContext, deps?: SectionServiceDeps) {
  return createSectionUseCase(input, context, deps);
}

export async function getSection(id: string, context: RequestContext, deps?: SectionServiceDeps) {
  return getSectionUseCase(id, context, deps);
}

export async function listSections(context: RequestContext, deps?: SectionServiceDeps, filter?: unknown) {
  return listSectionsUseCase(context, deps, filter);
}

export async function updateSection(id: string, input: unknown, context: RequestContext, deps?: SectionServiceDeps) {
  return updateSectionUseCase(id, input, context, deps);
}

export async function deactivateSection(id: string, context: RequestContext, deps?: SectionServiceDeps) {
  return deactivateSectionUseCase(id, context, deps);
}
