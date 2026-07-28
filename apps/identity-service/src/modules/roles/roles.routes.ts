import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { requireTenant } from "@school-erp/tenancy";
import { requirePermission } from "@school-erp/auth";
import { rolePermissions } from "./roles.permissions";
import { createRoleUseCase, deleteRoleUseCase, getRoleUseCase, listRolesUseCase, updateRoleUseCase } from "./use-cases";
import type { RoleServiceDeps } from "./roles.service";

function tenantContext(context: RequestContext) {
  return requireTenant(context.tenantContext);
}

function roleId(context: RequestContext) {
  return context.params.id ?? "";
}

export function registerRolesRoutes(router: ApiRouter, deps: RoleServiceDeps = {}): ApiRouter {
  router.route("GET", "/roles", async (context: RequestContext) => {
    requirePermission(context.authContext, rolePermissions.list);
    const result = await listRolesUseCase(tenantContext(context), deps);
    return jsonResponse(200, result);
  });

  router.route("GET", "/roles/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, rolePermissions.get);
    const result = await getRoleUseCase(tenantContext(context), roleId(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "role not found" });
  });

  router.route("POST", "/roles", async (context: RequestContext) => {
    requirePermission(context.authContext, rolePermissions.create);
    const result = await createRoleUseCase(tenantContext(context), context.body as Record<string, unknown>, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/roles/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, rolePermissions.update);
    const result = await updateRoleUseCase(tenantContext(context), roleId(context), context.body as Record<string, unknown>, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "role not found" });
  });

  router.route("DELETE", "/roles/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, rolePermissions.deactivate);
    const result = await deleteRoleUseCase(tenantContext(context), roleId(context), deps);
    return jsonResponse(result ? 204 : 404, result ? undefined : { message: "role not found" });
  });

  return router;
}
