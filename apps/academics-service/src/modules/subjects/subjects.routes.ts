import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { SubjectServiceDeps } from "./subjects.shared";
import { createSubject, deactivateSubject, getSubject, listSubjects, updateSubject } from "./subjects.service";
import { validateSubjectListFilter } from "./subjects.validator";

function subjectId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerSubjectRoutes(router: ApiRouter, deps: SubjectServiceDeps = {}): ApiRouter {
  router.route("GET", "/subjects", async (context: RequestContext) => {
    const result = await listSubjects(context, deps, validateSubjectListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/subjects/:id", async (context: RequestContext) => {
    const result = await getSubject(subjectId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "subject not found" });
  });

  router.route("POST", "/subjects", async (context: RequestContext) => {
    const result = await createSubject(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/subjects/:id", async (context: RequestContext) => {
    const result = await updateSubject(subjectId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "subject not found" });
  });

  router.route("POST", "/subjects/:id/deactivate", async (context: RequestContext) => {
    const result = await deactivateSubject(subjectId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "subject not found" });
  });

  return router;
}
