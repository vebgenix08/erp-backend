import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { createSettingsRouter } from "../routes";

const defaultRouter = createSettingsRouter();

export async function handleSettingsHttp(request: ApiRequest): Promise<ApiResponse> {
  return defaultRouter.handle(request);
}

export function createSettingsHttpHandler() {
  const router = createSettingsRouter();
  return (request: ApiRequest) => router.handle(request);
}
