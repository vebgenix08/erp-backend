import type { TemplateServiceContext } from "../templates.model";
import type { TemplateServiceDeps } from "../templates.service";
import { getTemplate } from "../templates.service";

export async function getTemplateUseCase(id: string, context: TemplateServiceContext, deps?: TemplateServiceDeps) {
  return getTemplate(id, context, deps);
}
