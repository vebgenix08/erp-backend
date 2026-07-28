import type { RequestContext } from "@school-erp/api";
import { closeAcademicYear, type AcademicYearServiceDeps } from "../academic-years.service";
export function closeAcademicYearUseCase(context:RequestContext,id:string,reason:unknown,deps?:AcademicYearServiceDeps){return closeAcademicYear(context,id,reason,deps);}
