import type { RequestContext } from "@school-erp/api";
import type { CampusServiceDeps } from "../campuses.service";
import { createCampus } from "../campuses.service";

export function createCampusUseCase(context: RequestContext, input: unknown, deps?: CampusServiceDeps) {
  return createCampus(context, input, deps);
}
