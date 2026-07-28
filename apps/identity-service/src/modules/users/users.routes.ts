import type { ApiRouter, RequestContext } from "@school-erp/api";
import { jsonResponse } from "@school-erp/api";
import { requireTenant } from "@school-erp/tenancy";
import { requirePermission } from "@school-erp/auth";
import { userPermissions } from "./users.permissions";
import {
  createUserUseCase,
  deleteUserUseCase,
  getUserUseCase,
  listUsersUseCase,
  updateUserUseCase,
} from "./use-cases";
import type { UserServiceDeps } from "./users.service";

function tenantContext(context: RequestContext) {
  return requireTenant(context.tenantContext);
}

function userId(context: RequestContext) {
  return context.params.id ?? "";
}

export function registerUsersRoutes(router: ApiRouter, deps: UserServiceDeps = {}): ApiRouter {
  router.route("GET", "/users", async (context: RequestContext) => {
    requirePermission(context.authContext, userPermissions.list);
    const result = await listUsersUseCase(tenantContext(context), deps);
    return jsonResponse(200, result);
  });

  router.route("GET", "/users/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, userPermissions.get);
    const result = await getUserUseCase(tenantContext(context), userId(context), deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "user not found" });
  });

  router.route("POST", "/users", async (context: RequestContext) => {
    requirePermission(context.authContext, userPermissions.create);
    const result = await createUserUseCase(tenantContext(context), context.body as Record<string, unknown>, deps);
    return jsonResponse(201, result);
  });

  router.route("PUT", "/users/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, userPermissions.update);
    const result = await updateUserUseCase(tenantContext(context), userId(context), context.body as Record<string, unknown>, deps);
    return jsonResponse(result ? 200 : 404, result ?? { message: "user not found" });
  });

  router.route("DELETE", "/users/:id", async (context: RequestContext) => {
    requirePermission(context.authContext, userPermissions.deactivate);
    const result = await deleteUserUseCase(tenantContext(context), userId(context), deps);
    return jsonResponse(result ? 204 : 404, result ? undefined : { message: "user not found" });
  });

  return router;
}
