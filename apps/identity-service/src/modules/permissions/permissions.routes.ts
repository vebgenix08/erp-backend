import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { requireTenant } from "@school-erp/tenancy";
import { requirePermission } from "@school-erp/auth";
import { permissionPermissions } from "./permissions.permissions";
import {
  getPermissionUseCase,
  listPermissionsUseCase,
} from "./use-cases";
import type { PermissionServiceDeps } from "./permissions.service";

function tenantContext(context: RequestContext) {
  return requireTenant(context.tenantContext);
}

function permissionId(context: RequestContext) {
  return context.params.id ?? "";
}

export function registerPermissionsRoutes(router: ApiRouter, deps: PermissionServiceDeps = {}): ApiRouter {
  router.route("GET", "/permissions", async (context: RequestContext) => {
    requirePermission(context.authContext, permissionPermissions.list);
    const result = await listPermissionsUseCase(tenantContext(context), deps);
    return jsonResponse(200, result);
  });

  router.route("GET", "/permissions/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, permissionPermissions.get);
    const result = await getPermissionUseCase(tenantContext(context), permissionId(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "permission not found" });
  });

  return router;
}
