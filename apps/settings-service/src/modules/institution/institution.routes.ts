import type { ApiRouter, RequestContext } from "@school-erp/api";
import { errorResponse, jsonResponse } from "@school-erp/api";
import type { InstitutionServiceDeps } from "./institution.service";
import { getInstitutionUseCase, updateInstitutionUseCase } from "./use-cases";

function toSettingsContext(context: RequestContext): RequestContext {
  return context;
}

export function registerInstitutionRoutes(router: ApiRouter, deps: InstitutionServiceDeps = {}): ApiRouter {
  router.route("GET", "/institution", async (context) => {
    const result = await getInstitutionUseCase(toSettingsContext(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "institution profile not found" });
  });

  router.route("PATCH", "/institution", async (context) => {
    const result = await updateInstitutionUseCase(context.body, toSettingsContext(context), deps);
    return jsonResponse(200, result);
  });

  return router;
}

export function mapInstitutionRouteError(error: unknown) {
  return errorResponse(error);
}
