import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { commsApp } from "../app";

export async function handleCommsHttp(request: ApiRequest): Promise<ApiResponse> {
  return commsApp.handle(request);
}

export { authMiddleware, tenantMiddleware, validationMiddleware } from "@school-erp/api";
