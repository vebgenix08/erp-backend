import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { SectionServiceDeps } from "./sections.shared";
import { createSection, deactivateSection, getSection, listSections, updateSection } from "./sections.service";
import { validateSectionListFilter } from "./sections.validator";

function sectionId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerSectionRoutes(router: ApiRouter, deps: SectionServiceDeps = {}): ApiRouter {
  router.route("GET", "/sections", async (context: RequestContext) => {
    const result = await listSections(context, deps, validateSectionListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/sections/:id", async (context: RequestContext) => {
    const result = await getSection(sectionId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "section not found" });
  });

  router.route("POST", "/sections", async (context: RequestContext) => {
    const result = await createSection(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/sections/:id", async (context: RequestContext) => {
    const result = await updateSection(sectionId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "section not found" });
  });

  router.route("POST", "/sections/:id/deactivate", async (context: RequestContext) => {
    const result = await deactivateSection(sectionId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "section not found" });
  });

  return router;
}
