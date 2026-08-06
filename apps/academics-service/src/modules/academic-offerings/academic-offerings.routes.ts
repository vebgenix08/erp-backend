import { jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import {
  createAcademicOffering,
  deactivateAcademicOffering,
  getAcademicOffering,
  listAcademicOfferings,
  type AcademicOfferingServiceDeps,
  updateAcademicOffering,
} from "./academic-offerings.service";
const id = (context: RequestContext) => context.params.id ?? "";
export function registerAcademicOfferingRoutes(router: ApiRouter, deps: AcademicOfferingServiceDeps = {}) {
  router.route("GET", "/academic-offerings", async (context) => jsonResponse(200, await listAcademicOfferings(context, context.query, deps)));
  router.route("GET", "/academic-offerings/:id", async (context) => {
    const result = await getAcademicOffering(id(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "academic offering not found" });
  });
  router.route("POST", "/academic-offerings", async (context) => jsonResponse(201, await createAcademicOffering(context.body, context, deps)));
  router.route("PUT", "/academic-offerings/:id", async (context) => {
    const result = await updateAcademicOffering(id(context), context.body, context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "academic offering not found" });
  });
  router.route("POST", "/academic-offerings/:id/deactivate", async (context) => {
    const result = await deactivateAcademicOffering(id(context), context, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "academic offering not found" });
  });
  return router;
}
