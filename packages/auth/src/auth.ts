import { BadRequestError, ForbiddenError, UnauthorizedError } from "@school-erp/errors";
import { buildAuthUser, buildTenantContext, ensurePermissionFormat, getBearerToken, normalizeAuthClaims, verifyAuthToken } from "./helpers";
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
  const bearerToken = getBearerToken(request);
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

  if (bearerToken && options.cognito) {
    throw new Error("async token verification must use resolveAuthFromRequestAsync");
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

export async function resolveAuthFromRequestAsync(
  request: AuthRequestLike = {},
  options: AuthContextOptions = {},
): Promise<AuthContext> {
  const claims = normalizeAuthClaims(request.jwtClaims ?? request.claims);
  const bearerToken = getBearerToken(request);

  if (claims) {
    return createContext({
      user: buildAuthUser(request, claims),
      tenant: buildTenantContext(request),
      requestId: request.requestId,
      source: "jwt-claims",
      authenticatedAt: new Date(),
    });
  }

  if (bearerToken && options.cognito) {
    const verifiedClaims = await verifyAuthToken(bearerToken, options.cognito, options.verifyJwt);
    if (!verifiedClaims?.sub) {
      throw new UnauthorizedError("invalid cognito token");
    }
    const user = buildAuthUser(
      {
        ...request,
        userId: verifiedClaims.sub,
        userEmail: verifiedClaims.email,
        userRole: verifiedClaims.role,
        userPermissions: verifiedClaims.permissions,
      },
      verifiedClaims,
    );
    return createContext({
      user,
      tenant: buildTenantContext({
        ...request,
        jwtClaims: verifiedClaims,
      }),
      requestId: request.requestId,
      source: "jwt-claims",
      authenticatedAt: new Date(),
    });
  }

  if (request.userId || request.userEmail || request.userRole || request.userPermissions || request.headers) {
    return createContext({
      user: buildAuthUser(request, claims),
      tenant: buildTenantContext(request),
      requestId: request.requestId,
      source: "headers",
      authenticatedAt: new Date(),
    });
  }

  return createContext({
    user: buildAuthUser(request, claims),
    tenant: buildTenantContext(request),
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
