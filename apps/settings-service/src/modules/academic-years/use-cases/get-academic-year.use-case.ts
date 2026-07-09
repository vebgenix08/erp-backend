import type { RequestContext } from "@school-erp/api";
import type { AcademicYearServiceDeps } from "../academic-years.service";
import { getAcademicYear } from "../academic-years.service";

export function getAcademicYearUseCase(context: RequestContext, id: string, deps?: AcademicYearServiceDeps) {
  return getAcademicYear(context, id, deps);
}
