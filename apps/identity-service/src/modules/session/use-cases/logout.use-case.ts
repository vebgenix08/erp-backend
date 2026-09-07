import type { RequestContext } from "@school-erp/api";
import { logout } from "../session.service";
import type { SessionServiceDeps } from "../session.service";

export async function logoutUseCase(context: RequestContext, deps?: SessionServiceDeps) {
  return logout(context, deps);
}
