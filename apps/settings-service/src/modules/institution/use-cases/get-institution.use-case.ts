import type { RequestContext } from "@school-erp/api";
import type { InstitutionServiceDeps } from "../institution.service";
import { getInstitutionProfile } from "../institution.service";

export function getInstitutionUseCase(context: RequestContext, deps?: InstitutionServiceDeps) {
  return getInstitutionProfile(context, deps);
}
