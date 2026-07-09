import type { RequestContext } from "@school-erp/api";
import type { CampusServiceDeps } from "../campuses.service";
import { deactivateCampus } from "../campuses.service";

export function deactivateCampusUseCase(context: RequestContext, id: string, deps?: CampusServiceDeps) {
  return deactivateCampus(context, id, deps);
}
