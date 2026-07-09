import type { RequestContext } from "@school-erp/api";
import type { AcademicYearServiceDeps } from "../academic-years.service";
import { updateAcademicYear } from "../academic-years.service";

export function updateAcademicYearUseCase(context: RequestContext, id: string, input: unknown, deps?: AcademicYearServiceDeps) {
  return updateAcademicYear(context, id, input, deps);
}
