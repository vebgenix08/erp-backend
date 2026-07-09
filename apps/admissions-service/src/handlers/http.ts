import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { createAdmissionsRouter } from "../routes";
import type { AdmissionsServiceDeps } from "../modules/enquiry/enquiry.service";

const defaultRouter = createAdmissionsRouter();

export async function handleAdmissionsHttp(request: ApiRequest): Promise<ApiResponse> {
  return defaultRouter.handle(request);
}

export function createAdmissionsHttpHandler(deps: AdmissionsServiceDeps = {}) {
  const router = createAdmissionsRouter(deps);
  return (request: ApiRequest) => router.handle(request);
}
