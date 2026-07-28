import type { RequestContext } from "@school-erp/api";
import { bootstrapPermissions } from "./bootstrap.permissions";
import { requirePlatformPermission } from "../../middleware";
import { toFirstAdminBootstrapView } from "./bootstrap.mapper";
import type { FirstAdminBootstrapRepository } from "./bootstrap.repository";
import { createFirstAdminBootstrapRepository } from "./bootstrap.repository";
import { validateFirstAdminBootstrapCompleteInput, validateFirstAdminBootstrapCreateInput } from "./bootstrap.validator";
import type {
  FirstAdminBootstrapRecord,
  FirstAdminBootstrapServiceContext,
  FirstAdminBootstrapView,
  FirstAdminInviteReceipt,
  FirstAdminInviteRequest,
} from "./bootstrap.model";
import { ConflictError, NotFoundError } from "@school-erp/errors";

export interface FirstAdminInvitePort {
  sendFirstAdminInvite(input: FirstAdminInviteRequest): Promise<FirstAdminInviteReceipt>;
  resendFirstAdminInvite?(input: FirstAdminInviteRequest): Promise<FirstAdminInviteReceipt>;
}

export const MAX_FIRST_ADMIN_INVITE_ATTEMPTS = 5;

export async function resendFirstAdminBootstrapInvite(
  tenantId: string,
  context: FirstAdminBootstrapServiceContext | RequestContext,
  deps?: FirstAdminBootstrapServiceDeps,
): Promise<FirstAdminBootstrapView> {
  requirePlatformPermission(context, bootstrapPermissions.create);
  const repository = await resolveRepository(deps);
  const existing = await repository.getByTenantId(tenantId);
  if (!existing) throw new NotFoundError("first admin bootstrap not found");
  if (existing.status === "COMPLETED") throw new ConflictError("completed administrator onboarding cannot be resent");
  if (existing.inviteAttempts >= MAX_FIRST_ADMIN_INVITE_ATTEMPTS) throw new ConflictError("administrator invite retry limit reached");
  const invitePort = deps?.invitePort;
  if (!invitePort) throw new ConflictError("administrator invite delivery is not configured");
  try {
    const request: FirstAdminInviteRequest = { tenantId, adminName: existing.adminName, adminEmail: existing.adminEmail, adminPhone: existing.adminPhone, roleCode: "TENANT_ADMIN", requestId: context.requestId };
    const receipt = await (invitePort.resendFirstAdminInvite?.(request) ?? invitePort.sendFirstAdminInvite(request));
    const updated = await repository.update(tenantId, { status: "INVITED", inviteId: receipt.inviteId, invitedAt: receipt.sentAt, inviteError: undefined, inviteAttempts: existing.inviteAttempts + 1, lastInviteAttemptAt: new Date() });
    return toFirstAdminBootstrapView(updated ?? existing) as FirstAdminBootstrapView;
  } catch (error) {
    const failed = await repository.update(tenantId, { status: "FAILED", inviteError: error instanceof Error ? error.message : "invite resend failed", inviteAttempts: existing.inviteAttempts + 1, lastInviteAttemptAt: new Date() });
    return toFirstAdminBootstrapView(failed ?? existing) as FirstAdminBootstrapView;
  }
}

export interface FirstAdminBootstrapServiceDeps {
  repository?: FirstAdminBootstrapRepository | Promise<FirstAdminBootstrapRepository>;
  invitePort?: FirstAdminInvitePort | undefined;
}

function resolveRepository(deps?: FirstAdminBootstrapServiceDeps): FirstAdminBootstrapRepository | Promise<FirstAdminBootstrapRepository> {
  return deps?.repository ?? createFirstAdminBootstrapRepository();
}

function newId(): string {
  return `bootstrap_${crypto.randomUUID()}`;
}

export async function createFirstAdminBootstrap(
  input: unknown,
  context: FirstAdminBootstrapServiceContext | RequestContext,
  deps?: FirstAdminBootstrapServiceDeps,
): Promise<FirstAdminBootstrapView> {
  requirePlatformPermission(context, bootstrapPermissions.create);
  const repository = await resolveRepository(deps);
  const payload = validateFirstAdminBootstrapCreateInput(input);
  const tenantId = payload.tenantId;

  const record: FirstAdminBootstrapRecord = {
    id: newId(),
    tenantId,
    adminName: payload.adminName,
    adminEmail: payload.adminEmail,
    adminPhone: payload.adminPhone,
    roleCode: "TENANT_ADMIN",
    status: "PENDING",
    inviteAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const created = await repository.create(record);
  const invitePort = deps?.invitePort;
  if (!invitePort) {
    return toFirstAdminBootstrapView(created) as FirstAdminBootstrapView;
  }

  try {
    const receipt = await invitePort.sendFirstAdminInvite({
      tenantId,
      adminName: created.adminName,
      adminEmail: created.adminEmail,
      adminPhone: created.adminPhone,
      roleCode: "TENANT_ADMIN",
      requestId: context.requestId,
    });
    const invited = await repository.update(tenantId, {
      status: "INVITED",
      inviteId: receipt.inviteId,
      invitedAt: receipt.sentAt,
      inviteAttempts: 1,
      lastInviteAttemptAt: new Date(),
    });
    return toFirstAdminBootstrapView(invited ?? created) as FirstAdminBootstrapView;
  } catch (error) {
    const failed = await repository.update(tenantId, {
      status: "FAILED",
      inviteError: error instanceof Error ? error.message : "invite failed",
      inviteAttempts: 1,
      lastInviteAttemptAt: new Date(),
    });
    return toFirstAdminBootstrapView(failed ?? created) as FirstAdminBootstrapView;
  }
}

export async function getFirstAdminBootstrap(
  tenantId: string,
  context: FirstAdminBootstrapServiceContext | RequestContext,
  deps?: FirstAdminBootstrapServiceDeps,
): Promise<FirstAdminBootstrapView | null> {
  requirePlatformPermission(context, bootstrapPermissions.read);
  const repository = await resolveRepository(deps);
  const record = await repository.getByTenantId(tenantId);
  return toFirstAdminBootstrapView(record);
}

export async function completeFirstAdminBootstrap(
  tenantId: string,
  input: unknown,
  context: FirstAdminBootstrapServiceContext | RequestContext,
  deps?: FirstAdminBootstrapServiceDeps,
): Promise<FirstAdminBootstrapView | null> {
  requirePlatformPermission(context, bootstrapPermissions.complete);
  const repository = await resolveRepository(deps);
  const existing = await repository.getByTenantId(tenantId);
  if (!existing) return null;
  if (existing.status === "COMPLETED") return toFirstAdminBootstrapView(existing);
  const payload = validateFirstAdminBootstrapCompleteInput(input);
  const updated = await repository.update(tenantId, {
    status: "COMPLETED",
    inviteId: payload.inviteId ?? existing.inviteId,
    completedAt: new Date(),
  });
  return toFirstAdminBootstrapView(updated);
}
