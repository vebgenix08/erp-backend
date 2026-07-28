import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { createStorageApp } from "../app";

const defaultRouter = createStorageApp();

export async function handleStorageHttp(request: ApiRequest): Promise<ApiResponse> {
  return defaultRouter.handle(request);
}

export function createStorageHttpHandler() {
  const router = createStorageApp();
  return (request: ApiRequest) => router.handle(request);
}
