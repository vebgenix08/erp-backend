import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { platformServiceRouter } from "../routes";

export async function handlePlatformHttp(request: ApiRequest): Promise<ApiResponse> {
  return platformServiceRouter.handle(request);
}
