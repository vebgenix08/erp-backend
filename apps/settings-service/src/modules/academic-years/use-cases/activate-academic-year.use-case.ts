import type { RequestContext } from "@school-erp/api";
import type { AcademicYearServiceDeps } from "../academic-years.service";
import { activateAcademicYear } from "../academic-years.service";

export function activateAcademicYearUseCase(context: RequestContext, id: string, deps?: AcademicYearServiceDeps) {
  return activateAcademicYear(context, id, deps);
}
