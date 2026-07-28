import { createRouter, type ApiRouter } from "@school-erp/api";
import { createStorageRouter } from "./routes";
import type { StorageServiceDeps } from "./modules/files/files.service";

export function createStorageApp(deps: StorageServiceDeps = {}): ApiRouter {
  return createStorageRouter(deps);
}

export const storageApp = createStorageApp();
