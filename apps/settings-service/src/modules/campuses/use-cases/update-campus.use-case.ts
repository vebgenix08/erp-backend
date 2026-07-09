import type { RequestContext } from "@school-erp/api";
import type { CampusServiceDeps } from "../campuses.service";
import { updateCampus } from "../campuses.service";

export function updateCampusUseCase(context: RequestContext, id: string, input: unknown, deps?: CampusServiceDeps) {
  return updateCampus(context, id, input, deps);
}
