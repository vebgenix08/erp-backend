import type { RequestContext } from "@school-erp/api";
import type { CampusServiceDeps } from "../campuses.service";
import { reactivateCampus } from "../campuses.service";

export function reactivateCampusUseCase(context: RequestContext, id: string, deps?: CampusServiceDeps) {
  return reactivateCampus(context, id, deps);
}
