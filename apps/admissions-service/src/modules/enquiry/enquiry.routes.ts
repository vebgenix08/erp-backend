import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { createEnquiryUseCase, closeEnquiryUseCase, getEnquiryUseCase, listEnquiriesUseCase, updateEnquiryUseCase } from "./use-cases";
import type { AdmissionsServiceDeps } from "./enquiry.service";
import { validateEnquiryListFilter } from "./enquiry.validator";

function toServiceContext(context: RequestContext) {
  return {
    tenantContext: context.tenantContext!,
    authContext: context.authContext!,
    requestId: context.requestId,
  };
}

function resolveEnquiryId(context: { params: Record<string, string> }): string {
  return context.params.id ?? "";
}

export function createEnquiryRouter(router: ApiRouter, deps: AdmissionsServiceDeps = {}): ApiRouter {
  router.route("POST", "/enquiries", async (context) => {
    const result = await createEnquiryUseCase(context.body, toServiceContext(context), deps);
    return jsonResponse(201, result);
  });

  router.route("GET", "/enquiries", async (context) => {
    const result = await listEnquiriesUseCase(toServiceContext(context), deps, validateEnquiryListFilter(context.query));
    return jsonResponse(200, result);
  });

  router.route("GET", "/enquiries/:id", async (context) => {
    const result = await getEnquiryUseCase(resolveEnquiryId(context), toServiceContext(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "enquiry not found" });
  });

  router.route("PUT", "/enquiries/:id", async (context) => {
    const result = await updateEnquiryUseCase(resolveEnquiryId(context), context.body, toServiceContext(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "enquiry not found" });
  });

  router.route("POST", "/enquiries/:id/close", async (context) => {
    const result = await closeEnquiryUseCase(resolveEnquiryId(context), toServiceContext(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "enquiry not found" });
  });

  return router;
}
