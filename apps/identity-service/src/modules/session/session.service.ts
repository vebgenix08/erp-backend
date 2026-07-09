import { requireAuth } from "@school-erp/auth";
import { createTenantContext } from "@school-erp/tenancy";
import type { RequestContext } from "@school-erp/api";
import type { SessionAuthContext, SessionRepository } from "./session.model";
import { sessionRepository as defaultRepository } from "./session.repository";
import { toSessionPayload, toSessionTenantSnapshot } from "./session.mapper";
import { validateSelectTenantInput } from "./session.validator";

export interface SessionServiceDeps {
  repository?: SessionRepository;
}

function resolveRepository(deps?: SessionServiceDeps): SessionRepository {
  return deps?.repository ?? defaultRepository;
}

export async function getSession(context: RequestContext, deps?: SessionServiceDeps) {
  const auth = requireAuth(context.authContext);
  const user = auth.user;
  if (!user) {
    throw new Error("auth user is required");
  }
  const selectedTenant = await resolveRepository(deps).getSelectedTenant(user.id);
  return toSessionPayload(auth as SessionAuthContext, selectedTenant);
}

export async function selectTenant(input: unknown, context: RequestContext, deps?: SessionServiceDeps) {
  const auth = requireAuth(context.authContext);
  const user = auth.user;
  if (!user) {
    throw new Error("auth user is required");
  }
  const payload = validateSelectTenantInput(input);
  const tenantContext = payload.tenantId
    ? createTenantContext({ tenantId: payload.tenantId, source: "request" })
    : createTenantContext({ tenantCode: payload.tenantCode, source: "request" });
  const selectedTenant = toSessionTenantSnapshot(tenantContext);
  if (!selectedTenant) {
    throw new Error("tenant selection failed");
  }
  await resolveRepository(deps).saveSelectedTenant(user.id, selectedTenant);
  return toSessionPayload(auth as SessionAuthContext, selectedTenant);
}

export async function logout(context: RequestContext) {
  void requireAuth(context.authContext);
  return { success: true };
}
