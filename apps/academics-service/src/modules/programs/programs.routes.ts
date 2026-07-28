import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import type { ProgramServiceDeps } from "./programs.shared";
import { createProgram, deactivateProgram, getProgram, listPrograms, updateProgram } from "./programs.service";
import { validateProgramListFilter } from "./programs.validator";

function programId(context: RequestContext): string {
  return context.params.id ?? "";
}

export function registerProgramRoutes(router: ApiRouter, deps: ProgramServiceDeps = {}): ApiRouter {
  router.route("GET", "/programs", async (context: RequestContext) => {
    const result = await listPrograms(context, deps, validateProgramListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/programs/:id", async (context: RequestContext) => {
    const result = await getProgram(programId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "program not found" });
  });

  router.route("POST", "/programs", async (context: RequestContext) => {
    const result = await createProgram(context.body, context, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/programs/:id", async (context: RequestContext) => {
    const result = await updateProgram(programId(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "program not found" });
  });

  router.route("POST", "/programs/:id/deactivate", async (context: RequestContext) => {
    const result = await deactivateProgram(programId(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "program not found" });
  });

  return router;
}
