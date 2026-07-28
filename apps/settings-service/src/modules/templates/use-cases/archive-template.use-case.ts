import type { TemplateServiceContext } from "../templates.model";
import type { TemplateServiceDeps } from "../templates.service";
import { archiveTemplate } from "../templates.service";

export async function archiveTemplateUseCase(id: string, context: TemplateServiceContext, deps?: TemplateServiceDeps) {
  return archiveTemplate(id, context, deps);
}
