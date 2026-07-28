import { createRouter } from "@school-erp/api";
import { registerAcademicYearRoutes } from "../modules/academic-years/academic-years.routes";
import { registerCampusRoutes } from "../modules/campuses/campuses.routes";
import { registerInstitutionRoutes } from "../modules/institution/institution.routes";
import { registerTemplateRoutes } from "../modules/templates/templates.routes";
import { registerNumberingRoutes } from "../modules/numbering/numbering.routes";
import { registerNotificationPolicyRoutes } from "../modules/notification-policy/notification-policy.routes";

export function createSettingsRouter() {
  const router = createRouter();
  registerInstitutionRoutes(router);
  registerCampusRoutes(router);
  registerAcademicYearRoutes(router);
  registerTemplateRoutes(router);
  registerNumberingRoutes(router);
  registerNotificationPolicyRoutes(router);
  return router;
}

export const settingsRouter = createSettingsRouter();
