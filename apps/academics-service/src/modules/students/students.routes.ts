import { jsonResponse, type ApiRouter, type RequestContext } from "@school-erp/api";
import {
  getStudent,
  listStudents,
  updateStudent,
  type StudentServiceDependencies,
} from "./students.service";
export function registerStudentRoutes(router: ApiRouter, deps: StudentServiceDependencies = {}) {
  router.route("GET", "/students", async (context: RequestContext) =>
    jsonResponse(200, await listStudents(context, context.query, deps)),
  );
  router.route("GET", "/students/:id", async (context: RequestContext) =>
    jsonResponse(200, await getStudent(context.params.id ?? "", context, deps)),
  );
  router.route("PATCH", "/students/:id", async (context: RequestContext) =>
    jsonResponse(200, await updateStudent(context.params.id ?? "", context.body, context, deps)),
  );
  return router;
}
