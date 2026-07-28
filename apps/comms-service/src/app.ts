import { authMiddleware, createRouter, tenantMiddleware, type ApiRouter } from "@school-erp/api";
import { registerCommsRoutes } from "./routes";

export function createCommsApp(): ApiRouter {
  const router = createRouter();
  router.use(authMiddleware());
  router.use(tenantMiddleware());
  registerCommsRoutes(router);
  return router;
}

export const commsApp = createCommsApp();
