import { createRouter, type ApiRouter } from "@school-erp/api";
import { registerTenantRoutes } from "../modules/tenants/tenants.routes";

export function createPlatformRouter(): ApiRouter {
  const router = createRouter();
  registerTenantRoutes(router);
  return router;
}

export const platformServiceRouter = createPlatformRouter();
