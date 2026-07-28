import type { RequestContext } from "@school-erp/api";
import { reopenAcademicYear, type AcademicYearServiceDeps } from "../academic-years.service";
export function reopenAcademicYearUseCase(context:RequestContext,id:string,reason:unknown,deps?:AcademicYearServiceDeps){return reopenAcademicYear(context,id,reason,deps);}
