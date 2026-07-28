import type { ApiRouter, RequestContext } from "@school-erp/api";
import { errorResponse, jsonResponse } from "@school-erp/api";
import type { CampusServiceDeps } from "./campuses.service";
import { createCampusUseCase, deactivateCampusUseCase, getCampusUseCase, listCampusesUseCase, reactivateCampusUseCase, updateCampusUseCase } from "./use-cases";
import { validateCampusListFilter } from "./campuses.validator";

function toSettingsContext(context: RequestContext): RequestContext {
  return context;
}

export function registerCampusRoutes(router: ApiRouter, deps: CampusServiceDeps = {}): ApiRouter {
  router.route("GET", "/campuses", async (context) => {
    const result = await listCampusesUseCase(toSettingsContext(context), deps, validateCampusListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("POST", "/campuses", async (context) => {
    const result = await createCampusUseCase(toSettingsContext(context), context.body, deps);
    return jsonResponse(201, result);
  });

  router.route("GET", "/campuses/:id", async (context) => {
    const result = await getCampusUseCase(toSettingsContext(context), context.params.id ?? "", deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "campus not found" });
  });

  router.route("PATCH", "/campuses/:id", async (context) => {
    const result = await updateCampusUseCase(toSettingsContext(context), context.params.id ?? "", context.body, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "campus not found" });
  });

  router.route("POST", "/campuses/:id/deactivate", async (context) => {
    const result = await deactivateCampusUseCase(toSettingsContext(context), context.params.id ?? "", deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "campus not found" });
  });

  router.route("POST", "/campuses/:id/reactivate", async (context) => {
    const result = await reactivateCampusUseCase(toSettingsContext(context), context.params.id ?? "", deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "campus not found" });
  });

  return router;
}

export function mapCampusRouteError(error: unknown) {
  return errorResponse(error);
}
