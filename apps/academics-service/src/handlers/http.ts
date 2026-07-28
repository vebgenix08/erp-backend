import type { ApiRequest, ApiResponse } from "@school-erp/api";
import { createAcademicsApp } from "../app";

const defaultRouter = createAcademicsApp();

export async function handleAcademicsHttp(request: ApiRequest): Promise<ApiResponse> {
  return defaultRouter.handle(request);
}

export function createAcademicsHttpHandler() {
  const router = createAcademicsApp();
  return (request: ApiRequest) => router.handle(request);
}
