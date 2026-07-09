import { authMiddleware, createRouter, tenantMiddleware, type ApiRouter } from "@school-erp/api";
import { registerIdentityRoutes } from "./routes";

export function createIdentityApp(): ApiRouter {
  const router = createRouter();
  router.use(authMiddleware());
  router.use(tenantMiddleware());
  registerIdentityRoutes(router);
  return router;
}

export const identityApp = createIdentityApp();
