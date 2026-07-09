import type { RequestContext } from "@school-erp/api";
import type { CampusServiceDeps } from "../campuses.service";
import { getCampus } from "../campuses.service";

export function getCampusUseCase(context: RequestContext, id: string, deps?: CampusServiceDeps) {
  return getCampus(context, id, deps);
}
