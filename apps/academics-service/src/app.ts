import { createRouter, type ApiRouter } from "@school-erp/api";
import { registerAcademicsRoutes } from "./routes";

export function createAcademicsApp(): ApiRouter {
  const router = createRouter();
  registerAcademicsRoutes(router);
  return router;
}

export const academicsApp = createAcademicsApp();
