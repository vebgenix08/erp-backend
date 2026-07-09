import { authMiddleware, tenantMiddleware, createRouter, type ApiRouter } from "@school-erp/api";
import { createEnquiryRouter } from "../modules/enquiry/enquiry.routes";
import type { AdmissionsServiceDeps } from "../modules/enquiry/enquiry.service";

export function createAdmissionsRouter(deps: AdmissionsServiceDeps = {}): ApiRouter {
  const router = createRouter();
  router.use(tenantMiddleware());
  router.use(authMiddleware());
  createEnquiryRouter(router, deps);
  return router;
}

export const admissionsServiceRouter = createAdmissionsRouter();
