import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { listAuditLogs, type AuditLogServiceDeps } from "./audit-logs.service";

export function registerAuditLogRoutes(router: ApiRouter, deps: AuditLogServiceDeps = {}): ApiRouter {
  router.route("GET", "/audit-logs", async (context: RequestContext) => {
    const result = await listAuditLogs(context, deps, {
      tenantId: typeof context.query.tenantId === "string" ? context.query.tenantId : undefined,
      entityType: typeof context.query.entityType === "string" ? context.query.entityType : undefined,
      action: typeof context.query.action === "string" ? context.query.action : undefined,
    });
    return jsonResponse(200, result);
  });
  return router;
}
