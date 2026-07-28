import type { ApiRouter } from "@school-erp/api";
import { registerClassRoutes } from "../modules/classes/classes.routes";
import { registerSectionRoutes } from "../modules/sections/sections.routes";
import { registerSubjectRoutes } from "../modules/subjects/subjects.routes";
import { registerProgramRoutes } from "../modules/programs/programs.routes";
import { registerStudentRoutes } from "../modules/students/students.routes";

export function registerAcademicsRoutes(router: ApiRouter): ApiRouter {
  registerProgramRoutes(router);
  registerClassRoutes(router);
  registerSectionRoutes(router);
  registerSubjectRoutes(router);
  registerStudentRoutes(router);
  return router;
}
