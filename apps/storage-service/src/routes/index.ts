import { createRouter, type ApiRouter } from "@school-erp/api";
import { registerStorageRoutes } from "../modules/files/files.routes";
import type { StorageServiceDeps } from "../modules/files/files.service";

export function createStorageRouter(deps: StorageServiceDeps = {}): ApiRouter {
  const router = createRouter();
  registerStorageRoutes(router, deps);
  return router;
}

export const storageRouter = createStorageRouter();
