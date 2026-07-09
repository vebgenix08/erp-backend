import { BadRequestError, ForbiddenError, UnauthorizedError } from "@school-erp/errors";
import { buildAuthUser, buildTenantContext, ensurePermissionFormat, normalizeAuthClaims } from "./helpers";
import type { AuthContext, AuthContextOptions, AuthRequestLike, AuthResolutionSource, AuthUser, Permission } from "./types";

function createContext(
  partial: Partial<AuthContext> & Pick<AuthContext, "source" | "authenticatedAt">,
): AuthContext {
  return {
    user: partial.user,
    tenant: partial.tenant,
    requestId: partial.requestId,
    source: partial.source,
    authenticatedAt: partial.authenticatedAt,
  };
}

export function resolveAuthFromRequest(
  request: AuthRequestLike = {},
  options: AuthContextOptions = {},
): AuthContext {
  const claims = normalizeAuthClaims(request.jwtClaims ?? request.claims);
  const user = buildAuthUser(request, claims);
  const tenant = buildTenantContext(request);

  if (claims) {
    return createContext({
      user,
      tenant,
      requestId: request.requestId,
      source: "jwt-claims",
      authenticatedAt: new Date(),
    });
  }

  if (request.userId || request.userEmail || request.userRole || request.userPermissions || request.headers) {
    return createContext({
      user,
      tenant,
      requestId: request.requestId,
      source: "headers",
      authenticatedAt: new Date(),
    });
  }

  return createContext({
    user,
    tenant,
    requestId: request.requestId,
    source: options.defaultSource ?? "unknown",
    authenticatedAt: new Date(),
  });
}

export function requireAuth(context: AuthContext | undefined): AuthContext {
  if (!context?.user?.id) {
    throw new UnauthorizedError("authentication is required");
  }
  return context;
}

export function hasPermission(context: AuthContext | undefined, permission: string): boolean {
  const user = context?.user;
  if (!user) return false;
  const normalized = permission.trim().toLowerCase();
  const permissions = user.permissions ?? [];
  return permissions.includes(normalized as Permission) || permissions.includes("*" as Permission);
}

export function requirePermission(context: AuthContext | undefined, permission: string): AuthContext {
  requireAuth(context);
  if (!hasPermission(context, ensurePermissionFormat(permission))) {
    throw new ForbiddenError(`missing permission: ${permission}`);
  }
  return context as AuthContext;
}

export type { AuthContext, AuthRequestLike, AuthResolutionSource, AuthUser, Permission };
