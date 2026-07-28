import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { platformApp } from "../app";

export async function handlePlatformHttp(request: ApiRequest): Promise<ApiResponse> {
  return platformApp.handle(request);
}
