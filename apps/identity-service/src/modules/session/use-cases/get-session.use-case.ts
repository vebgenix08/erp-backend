import type { RequestContext } from "@school-erp/api";
import type { SessionServiceDeps } from "../session.service";
import { getSession } from "../session.service";

export async function getSessionUseCase(context: RequestContext, deps?: SessionServiceDeps) {
  return getSession(context, deps);
}
