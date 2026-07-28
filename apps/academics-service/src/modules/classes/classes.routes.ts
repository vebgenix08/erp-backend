import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { ClassServiceDeps } from "./classes.shared";
import { createClass, deactivateClass, getClass, listClasses, updateClass } from "./classes.service";
import { validateClassListFilter } from "./classes.validator";

function classId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerClassRoutes(router: ApiRouter, deps: ClassServiceDeps = {}): ApiRouter {
  router.route("GET", "/classes", async (context: RequestContext) => {
    const result = await listClasses(context, deps, validateClassListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/classes/:id", async (context: RequestContext) => {
    const result = await getClass(classId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "class not found" });
  });

  router.route("POST", "/classes", async (context: RequestContext) => {
    const result = await createClass(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/classes/:id", async (context: RequestContext) => {
    const result = await updateClass(classId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "class not found" });
  });

  router.route("POST", "/classes/:id/deactivate", async (context: RequestContext) => {
    const result = await deactivateClass(classId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "class not found" });
  });

  return router;
}
