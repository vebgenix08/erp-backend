import { jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import {
  createCurriculum,
  deactivateCurriculum,
  getCurriculum,
  listCurricula,
  type CurriculumServiceDeps,
  updateCurriculum,
} from "./curricula.service";

const id = (context: RequestContext) => context.params.id ?? "";
export function registerCurriculumRoutes(router: ApiRouter, deps: CurriculumServiceDeps = {}) {
  router.route("GET", "/curricula", async (context) => jsonResponse(200, await listCurricula(context, context.query, deps)));
  router.route("GET", "/curricula/:id", async (context) => {
    const result = await getCurriculum(id(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "curriculum not found" });
  });
  router.route("POST", "/curricula", async (context) => jsonResponse(201, await createCurriculum(context.body, context, deps)));
  router.route("PUT", "/curricula/:id", async (context) => {
    const result = await updateCurriculum(id(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "curriculum not found" });
  });
  router.route("POST", "/curricula/:id/deactivate", async (context) => {
    const result = await deactivateCurriculum(id(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "curriculum not found" });
  });
  return router;
}
