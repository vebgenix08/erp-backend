import { ConflictError } from "@school-erp/errors";
import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { createInMemoryInviteDelivery, buildInviteEmailHtml, buildInviteEmailSubject, buildInviteEmailText, type InviteDeliveryPort } from "@school-erp/comms";
import { toInviteView } from "./invites.mapper";
import { invitePermissions } from "./invites.permissions";
import { inviteRepository as defaultRepository, type InviteRepository } from "./invites.repository";
import { validateInviteCreateInput, validateInviteListFilter, validateInviteUpdateInput } from "./invites.validator";
import type { InviteCreateInput, InviteListFilter, InviteServiceContext, InviteView } from "./invites.model";

export interface InviteServiceDeps {
  repository?: InviteRepository | undefined;
  delivery?: InviteDeliveryPort | undefined;
  baseUrl?: string | undefined;
}

const defaultDelivery = createInMemoryInviteDelivery();

function resolveRepository(deps?: InviteServiceDeps): InviteRepository {
  return deps?.repository ?? defaultRepository;
}

function resolveDelivery(deps?: InviteServiceDeps): InviteDeliveryPort {
  return deps?.delivery ?? defaultDelivery;
}

function getTenantId(context: InviteServiceContext): string {
  return requireTenantId(context.tenantContext);
}

function getActorId(context: InviteServiceContext): string {
  const auth = requireAuth(context.authContext);
  const userId = auth.user?.id?.trim();
  if (!userId) {
    throw new Error("authenticated user id is required");
  }
  return userId;
}

function assertPermission(context: InviteServiceContext, permission: string): void {
  requirePermission(context.authContext, permission);
}

function buildInviteUrl(baseUrl: string | undefined, token: string, tenantId: string, email: string): string {
  const root = (baseUrl ?? "http://localhost:3000").replace(/\/+$/g, "");
  const params = new URLSearchParams({
    token,
    tenantId,
    email,
  });
  return `${root}/accept-invite?${params.toString()}`;
}

function buildInviteExpiry(expiresInDays: number | undefined): Date {
  const days = expiresInDays ?? 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function toRecordMessage(record: InviteView, createdBy: string) {
  const subject = buildInviteEmailSubject(record.email, record.role);
  return {
    inviteId: record.id,
    tenantId: record.tenantId,
    email: record.email,
    role: record.role,
    inviteUrl: record.inviteUrl,
    subject,
    text: buildInviteEmailText({
      inviteId: record.id,
      tenantId: record.tenantId,
      email: record.email,
      role: record.role,
      inviteUrl: record.inviteUrl,
      subject,
      text: "",
      html: "",
      createdBy,
    }),
    html: buildInviteEmailHtml({
      inviteId: record.id,
      tenantId: record.tenantId,
      email: record.email,
      role: record.role,
      inviteUrl: record.inviteUrl,
      subject,
      text: "",
      html: "",
      createdBy,
    }),
    createdBy,
  };
}

export async function createInvite(
  input: unknown,
  context: InviteServiceContext,
  deps?: InviteServiceDeps,
): Promise<InviteView> {
  assertPermission(context, invitePermissions.create);
  const repository = resolveRepository(deps);
  const delivery = resolveDelivery(deps);
  const tenantId = getTenantId(context);
  const actorId = getActorId(context);
  const payload = validateInviteCreateInput(input);
  const existing = await repository.findByEmail(tenantId, payload.email);
  if (existing && !["REVOKED", "EXPIRED"].includes(existing.status)) {
    throw new ConflictError("invite already exists for email");
  }

  const now = new Date();
  const token = newId().replace(/-/g, "");
  const inviteUrl = buildInviteUrl(deps?.baseUrl, token, tenantId, payload.email);
  const record = await repository.create(tenantId, {
    id: newId(),
    tenantId,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
    status: "PENDING",
    token,
    inviteUrl,
    expiresAt: buildInviteExpiry(payload.expiresInDays),
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    deliveryStatus: "QUEUED",
    resendCount: 0,
  });

  const deliveryResult = await delivery.sendInviteEmail(toRecordMessage(toInviteView(record) as InviteView, actorId));

  const updated = await repository.update(tenantId, record.id, {
    status: "SENT",
    sentAt: deliveryResult.sentAt,
    deliveryStatus: "SENT",
    deliveryMessageId: deliveryResult.messageId,
    lastSentAt: deliveryResult.sentAt,
    updatedAt: new Date(),
  });

  return toInviteView(updated ?? record) as InviteView;
}

export async function getInvite(id: string, context: InviteServiceContext, deps?: InviteServiceDeps): Promise<InviteView | null> {
  assertPermission(context, invitePermissions.read);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  return toInviteView(await repository.getById(tenantId, id));
}

export async function listInvites(
  context: InviteServiceContext,
  deps?: InviteServiceDeps,
  filter?: InviteListFilter,
): Promise<InviteView[]> {
  assertPermission(context, invitePermissions.read);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const invites = await repository.list(tenantId, validateInviteListFilter(filter));
  return invites.map((invite) => toInviteView(invite) as InviteView);
}

export async function updateInvite(
  id: string,
  input: unknown,
  context: InviteServiceContext,
  deps?: InviteServiceDeps,
): Promise<InviteView | null> {
  assertPermission(context, invitePermissions.update);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const payload = validateInviteUpdateInput(input);
  const existing = await repository.getById(tenantId, id);
  if (!existing) {
    return null;
  }
  if (existing.status === "REVOKED" || existing.status === "ACCEPTED") {
    throw new ConflictError("invite cannot be updated");
  }
  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (payload.fullName !== undefined) {
    patch.fullName = payload.fullName;
  }
  if (payload.role !== undefined) {
    patch.role = payload.role;
  }
  const updated = await repository.update(tenantId, id, patch as never);
  return toInviteView(updated);
}

export async function resendInvite(
  id: string,
  context: InviteServiceContext,
  deps?: InviteServiceDeps,
): Promise<InviteView | null> {
  assertPermission(context, invitePermissions.resend);
  const repository = resolveRepository(deps);
  const delivery = resolveDelivery(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) {
    return null;
  }
  if (existing.status === "REVOKED" || existing.status === "ACCEPTED") {
    throw new ConflictError("invite cannot be resent");
  }

  const deliveryResult = await delivery.sendInviteEmail(toRecordMessage(toInviteView(existing) as InviteView, getActorId(context)));
  const updated = await repository.update(tenantId, id, {
    status: "SENT",
    sentAt: deliveryResult.sentAt,
    deliveryStatus: "SENT",
    deliveryMessageId: deliveryResult.messageId,
    lastSentAt: deliveryResult.sentAt,
    resendCount: existing.resendCount + 1,
    updatedAt: new Date(),
  });
  return toInviteView(updated);
}

export async function revokeInvite(
  id: string,
  context: InviteServiceContext,
  deps?: InviteServiceDeps,
): Promise<InviteView | null> {
  assertPermission(context, invitePermissions.revoke);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const existing = await repository.getById(tenantId, id);
  if (!existing) {
    return null;
  }
  if (existing.status === "REVOKED") {
    return toInviteView(existing);
  }
  const now = new Date();
  const updated = await repository.update(tenantId, id, {
    status: "REVOKED",
    revokedAt: now,
    updatedAt: now,
  });
  return toInviteView(updated);
}
