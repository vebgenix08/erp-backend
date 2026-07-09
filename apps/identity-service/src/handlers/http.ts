import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { identityApp } from "../app";

export async function handleIdentityHttp(request: ApiRequest): Promise<ApiResponse> {
  return identityApp.handle(request);
}
