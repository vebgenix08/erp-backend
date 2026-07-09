import type { RequestContext } from "@school-erp/api";
import type { InstitutionServiceDeps } from "../institution.service";
import { updateInstitutionProfile } from "../institution.service";

export function updateInstitutionUseCase(input: unknown, context: RequestContext, deps?: InstitutionServiceDeps) {
  return updateInstitutionProfile(input, context, deps);
}
