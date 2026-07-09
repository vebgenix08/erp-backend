import { createRouter } from "@school-erp/api";
import { registerAcademicYearRoutes } from "../modules/academic-years/academic-years.routes";
import { registerCampusRoutes } from "../modules/campuses/campuses.routes";
import { registerInstitutionRoutes } from "../modules/institution/institution.routes";

export function createSettingsRouter() {
  const router = createRouter();
  registerInstitutionRoutes(router);
  registerCampusRoutes(router);
  registerAcademicYearRoutes(router);
  return router;
}

export const settingsRouter = createSettingsRouter();
