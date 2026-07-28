import type { TemplateServiceContext } from "../templates.model";
import type { TemplateServiceDeps } from "../templates.service";
import { updateTemplate } from "../templates.service";

export async function updateTemplateUseCase(id: string, input: unknown, context: TemplateServiceContext, deps?: TemplateServiceDeps) {
  return updateTemplate(id, input, context, deps);
}
