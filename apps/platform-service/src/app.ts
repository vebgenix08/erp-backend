import { authMiddleware, createRouter, type ApiRouter } from "@school-erp/api";
import { registerPlatformRoutes } from "./routes";

export function createPlatformApp(): ApiRouter {
  const router = createRouter();
  router.use(authMiddleware());
  return registerPlatformRoutes(router);
}

export const platformApp = createPlatformApp();
