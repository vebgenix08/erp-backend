import type { RequestContext } from "@school-erp/api";
import type { CampusListFilter } from "../campuses.model";
import type { CampusServiceDeps } from "../campuses.service";
import { listCampuses } from "../campuses.service";

export function listCampusesUseCase(context: RequestContext, deps?: CampusServiceDeps, filter?: CampusListFilter) {
  return listCampuses(context, deps, filter);
}
