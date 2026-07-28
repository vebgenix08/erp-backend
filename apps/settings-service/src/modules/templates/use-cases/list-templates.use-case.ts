import type { TemplateServiceContext } from "../templates.model";
import type { TemplateServiceDeps } from "../templates.service";
import { listTemplates } from "../templates.service";

export async function listTemplatesUseCase(context: TemplateServiceContext, deps?: TemplateServiceDeps, filter?: unknown) {
  return listTemplates(context, deps, filter);
}
