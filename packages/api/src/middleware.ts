import { requireAuth, resolveAuthFromRequest } from "@school-erp/auth";
import { requireTenant, resolveTenantFromRequest } from "@school-erp/tenancy";
import { BadRequestError } from "@school-erp/errors";
import type { ApiMiddleware, RequestContext } from "./types";
import { getHeaderValue } from "./request";

export function authMiddleware(): ApiMiddleware {
  return async (context, next) => {
    const authContext = resolveAuthFromRequest({
      requestId: context.requestId,
      headers: context.headers,
      tenantId: context.tenantContext?.tenantId,
    });
    context.authContext = requireAuth(authContext);
    return next();
  };
}

export function tenantMiddleware(): ApiMiddleware {
  return async (context, next) => {
    const tenantContext = resolveTenantFromRequest({
      requestId: context.requestId,
      headers: context.headers,
      tenantId: context.tenantContext?.tenantId,
      hostname: getHeaderValue(context.headers, "host"),
    });
    context.tenantContext = requireTenant(tenantContext.tenantId ? tenantContext : undefined);
    return next();
  };
}

export function validationMiddleware<TContext extends RequestContext>(
  validator: (context: TContext) => void | Promise<void>,
): ApiMiddleware {
  return async (context, next) => {
    await validator(context as TContext);
    return next();
  };
}

export function bodyRequiredMiddleware(): ApiMiddleware {
  return async (context, next) => {
    if (context.body === undefined || context.body === null) {
      throw new BadRequestError("request body is required");
    }
    return next();
  };
}
