import type { ApiRouter, RequestContext } from "@school-erp/api";
import { errorResponse, jsonResponse } from "@school-erp/api";
import type { AcademicYearServiceDeps } from "./academic-years.service";
import { activateAcademicYearUseCase, createAcademicYearUseCase, getAcademicYearUseCase, listAcademicYearsUseCase, updateAcademicYearUseCase } from "./use-cases";
import { validateAcademicYearListFilter } from "./academic-years.validator";

function toSettingsContext(context: RequestContext): RequestContext {
  return context;
}

export function registerAcademicYearRoutes(router: ApiRouter, deps: AcademicYearServiceDeps = {}): ApiRouter {
  router.route("GET", "/academic-years", async (context) => {
    const result = await listAcademicYearsUseCase(toSettingsContext(context), deps, validateAcademicYearListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("POST", "/academic-years", async (context) => {
    const result = await createAcademicYearUseCase(toSettingsContext(context), context.body, deps);
    return jsonResponse(201, result);
  });

  router.route("GET", "/academic-years/:id", async (context) => {
    const result = await getAcademicYearUseCase(toSettingsContext(context), context.params.id ?? "", deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "academic year not found" });
  });

  router.route("PATCH", "/academic-years/:id", async (context) => {
    const result = await updateAcademicYearUseCase(toSettingsContext(context), context.params.id ?? "", context.body, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "academic year not found" });
  });

  router.route("POST", "/academic-years/:id/activate", async (context) => {
    const result = await activateAcademicYearUseCase(toSettingsContext(context), context.params.id ?? "", deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "academic year not found" });
  });

  return router;
}

export function mapAcademicYearRouteError(error: unknown) {
  return errorResponse(error);
}
