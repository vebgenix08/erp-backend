import type { RequestContext } from "@school-erp/api";
import type { AcademicYearListFilter } from "../academic-years.model";
import type { AcademicYearServiceDeps } from "../academic-years.service";
import { listAcademicYears } from "../academic-years.service";

export function listAcademicYearsUseCase(context: RequestContext, deps?: AcademicYearServiceDeps, filter?: AcademicYearListFilter) {
  return listAcademicYears(context, deps, filter);
}
