import type { RequestContext } from "@school-erp/api";
import { logout } from "../session.service";

export async function logoutUseCase(context: RequestContext) {
  return logout(context);
}
