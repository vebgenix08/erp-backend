import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { TemplateServiceDeps } from "./templates.service";
import { archiveTemplate, createTemplate, getTemplate, listTemplates, publishTemplate, updateTemplate } from "./templates.service";
import { validateTemplateListFilter } from "./templates.validator";

function templateId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerTemplateRoutes(router: ApiRouter, deps: TemplateServiceDeps = {}): ApiRouter {
  router.route("GET", "/templates", async (context: RequestContext) => {
    const result = await listTemplates(context, deps, validateTemplateListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/templates/:id", async (context: RequestContext) => {
    const result = await getTemplate(templateId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "template not found" });
  });

  router.route("POST", "/templates", async (context: RequestContext) => {
    const result = await createTemplate(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/templates/:id", async (context: RequestContext) => {
    const result = await updateTemplate(templateId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "template not found" });
  });

  router.route("POST", "/templates/:id/publish", async (context: RequestContext) => {
    const result = await publishTemplate(templateId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "template not found" });
  });

  router.route("DELETE", "/templates/:id", async (context: RequestContext) => {
    const result = await archiveTemplate(templateId(context), context, deps);
    return jsonResponse(result ? 204 : 404, result ? undefined : { message: "template not found" });
  });

  return router;
}
