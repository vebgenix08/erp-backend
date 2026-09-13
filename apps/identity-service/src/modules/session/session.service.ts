import { requireAuth, type Permission } from "@school-erp/auth";
import { ForbiddenError } from "@school-erp/errors";
import { createTenantContext } from "@school-erp/tenancy";
import type { RequestContext } from "@school-erp/api";
import type { SessionAuthContext, SessionPayload, SessionRepository } from "./session.model";
import { sessionRepository as defaultRepository } from "./session.repository";
import {
  toSessionPayload,
  toSessionTenantSnapshot,
  type ResolvedSessionAuthorization,
} from "./session.mapper";
import { validateSelectTenantInput } from "./session.validator";
import type { AccessRepository } from "../access/access.repository";
import type { RoleRepository } from "../roles/roles.repository";
import type { UserRepository } from "../users/users.repository";
import { activateEmployeeLogin, resolveEmployeeByPrincipal } from "../employees/employees.service";
import { resolvePrincipalAuthorization } from "../access/authorization.service";
import { bootstrapCurrentTenantAdmin } from "../access/access.service";

type EmployeeLoginActivator = (tenantId: string, email: string) => Promise<unknown>;
type TenantAdminBootstrapper = (context: RequestContext) => Promise<unknown>;
type SessionEmployeeResolver = (
  tenantId: string,
  principalId: string,
) => Promise<{ fullName?: string; profilePhotoFileId?: string } | null>;

export interface SessionServiceDeps {
  repository?: SessionRepository;
  accessRepository?: AccessRepository;
  roleRepository?: RoleRepository | Promise<RoleRepository>;
  userRepository?: UserRepository | Promise<UserRepository>;
  employeeLoginActivator?: EmployeeLoginActivator;
  tenantAdminBootstrapper?: TenantAdminBootstrapper;
  employeeResolver?: SessionEmployeeResolver;
}

function resolveRepository(deps?: SessionServiceDeps): SessionRepository {
  return deps?.repository ?? defaultRepository;
}

async function attachEmployeeProfile(
  payload: SessionPayload,
  tenantId: string | undefined,
  principalId: string,
  deps?: SessionServiceDeps,
): Promise<SessionPayload> {
  const employee = tenantId
    ? await (deps?.employeeResolver ?? resolveEmployeeByPrincipal)(tenantId, principalId)
    : null;
  return {
    ...payload,
    user: {
      ...payload.user,
      ...(employee?.fullName ? { fullName: employee.fullName } : {}),
      ...(employee?.profilePhotoFileId ? { profilePhotoFileId: employee.profilePhotoFileId } : {}),
    },
  };
}

async function resolveAuthorization(
  auth: SessionAuthContext,
  deps: SessionServiceDeps = {},
): Promise<ResolvedSessionAuthorization | undefined> {
  const authUser = auth.user;
  const tenantId = auth.tenant?.tenantId;
  if (!authUser || !tenantId) return undefined;
  const resolved = await resolvePrincipalAuthorization(tenantId, authUser.id, deps);
  if (!resolved) return undefined;
  return {
    role: resolved.role ?? authUser.role,
    roles: resolved.roles,
    permissions: resolved.permissions as Permission[],
    scopes: resolved.scopes,
  };
}

export async function getSession(context: RequestContext, deps?: SessionServiceDeps) {
  const auth = requireAuth(context.authContext);
  const user = auth.user;
  if (!user) {
    throw new Error("auth user is required");
  }
  if (user.role === "TENANT_ADMIN") {
    await (deps?.tenantAdminBootstrapper ?? bootstrapCurrentTenantAdmin)(context);
  }
  const authContext = auth as SessionAuthContext;
  const tenantId = authContext.tenant?.tenantId;
  if (tenantId && user.email) {
    await (deps?.employeeLoginActivator ?? activateEmployeeLogin)(tenantId, user.email);
  }
  const persistedTenant = await resolveRepository(deps).getSelectedTenant(user.id);
  const authenticatedTenant = toSessionTenantSnapshot(authContext.tenant);
  const selectedTenant =
    persistedTenant?.tenantId === authenticatedTenant?.tenantId
      ? persistedTenant
      : authenticatedTenant;
  return attachEmployeeProfile(
    toSessionPayload(authContext, selectedTenant, await resolveAuthorization(authContext, deps)),
    tenantId,
    user.id,
    deps,
  );
}

export async function selectTenant(
  input: unknown,
  context: RequestContext,
  deps?: SessionServiceDeps,
) {
  const auth = requireAuth(context.authContext);
  const user = auth.user;
  if (!user) {
    throw new Error("auth user is required");
  }
  if (user.role === "TENANT_ADMIN") {
    await (deps?.tenantAdminBootstrapper ?? bootstrapCurrentTenantAdmin)(context);
  }
  const payload = validateSelectTenantInput(input);
  const authenticatedTenant = toSessionTenantSnapshot((auth as SessionAuthContext).tenant);
  if (!authenticatedTenant)
    throw new ForbiddenError("tenant selection requires an authenticated tenant membership");
  const tenantContext = payload.tenantId
    ? createTenantContext({ tenantId: payload.tenantId, source: "request" })
    : createTenantContext({
        tenantCode: payload.tenantCode,
        source: "request",
      });
  const selectedTenant = toSessionTenantSnapshot(tenantContext);
  if (!selectedTenant) {
    throw new Error("tenant selection failed");
  }
  const matchesTenantId = selectedTenant.tenantId === authenticatedTenant.tenantId;
  const matchesTenantCode = Boolean(
    selectedTenant.tenantCode &&
      authenticatedTenant.tenantCode &&
      selectedTenant.tenantCode === authenticatedTenant.tenantCode,
  );
  if (!matchesTenantId && !matchesTenantCode) {
    throw new ForbiddenError("requested tenant is not an authenticated membership");
  }
  await resolveRepository(deps).saveSelectedTenant(user.id, selectedTenant);
  const authContext = auth as SessionAuthContext;
  return attachEmployeeProfile(
    toSessionPayload(authContext, selectedTenant, await resolveAuthorization(authContext, deps)),
    selectedTenant.tenantId,
    user.id,
    deps,
  );
}

export async function logout(context: RequestContext, deps?: SessionServiceDeps) {
  const auth = requireAuth(context.authContext);
  const userId = auth.user?.id;
  if (!userId) throw new Error("auth user is required");
  await resolveRepository(deps).deleteSelectedTenant(userId);
  return { success: true };
}
