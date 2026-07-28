import { authMiddleware, tenantMiddleware, createRouter, type ApiRouter } from "@school-erp/api";
import { createEnquiryRouter } from "../modules/enquiry/enquiry.routes";
import type { AdmissionsServiceDeps } from "../modules/enquiry/enquiry.service";
import { createApplicationRouter } from "../modules/application/application.routes";
import type { ApplicationServiceDeps } from "../modules/application/application.service";

export function createAdmissionsRouter(enquiryDeps: AdmissionsServiceDeps = {}, applicationDeps: ApplicationServiceDeps = {}): ApiRouter {
  const router = createRouter();
  router.use(tenantMiddleware());
  router.use(authMiddleware());
  createEnquiryRouter(router, enquiryDeps);
  createApplicationRouter(router, applicationDeps);
  return router;
}

export const admissionsServiceRouter = createAdmissionsRouter();
