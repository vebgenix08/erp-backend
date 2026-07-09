import type { RequestContext } from "@school-erp/api";
import type { AcademicYearServiceDeps } from "../academic-years.service";
import { createAcademicYear } from "../academic-years.service";

export function createAcademicYearUseCase(context: RequestContext, input: unknown, deps?: AcademicYearServiceDeps) {
  return createAcademicYear(context, input, deps);
}
