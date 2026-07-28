import type { RequestContext } from "@school-erp/api";
import { requirePermission } from "@school-erp/auth";
import { ForbiddenError } from "@school-erp/errors";

export function requirePlatformPermission(context: Pick<RequestContext, "authContext">, permission: string): void {
  const auth = requirePermission(context.authContext, permission);
  if (auth.user?.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("platform administrator access is required");
  }
}
