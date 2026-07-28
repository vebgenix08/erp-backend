import type { TemplateServiceContext } from "../templates.model";
import type { TemplateServiceDeps } from "../templates.service";
import { createTemplate } from "../templates.service";

export async function createTemplateUseCase(input: unknown, context: TemplateServiceContext, deps?: TemplateServiceDeps) {
  return createTemplate(input, context, deps);
}
