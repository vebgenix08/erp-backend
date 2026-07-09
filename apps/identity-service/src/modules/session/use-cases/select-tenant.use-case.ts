import type { RequestContext } from "@school-erp/api";
import type { SessionServiceDeps } from "../session.service";
import { selectTenant } from "../session.service";

export async function selectTenantUseCase(input: unknown, context: RequestContext, deps?: SessionServiceDeps) {
  return selectTenant(input, context, deps);
}
