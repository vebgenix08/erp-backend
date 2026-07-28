import type { TemplateServiceContext } from "../templates.model";
import type { TemplateServiceDeps } from "../templates.service";
import { publishTemplate } from "../templates.service";

export async function publishTemplateUseCase(id: string, context: TemplateServiceContext, deps?: TemplateServiceDeps) {
  return publishTemplate(id, context, deps);
}
