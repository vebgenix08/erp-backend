import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { inviteEmailRepository as defaultRepository, type InviteEmailRepository } from "./invite-email.repository";
import { inviteEmailPermissions } from "./invite-email.permissions";
import { toInviteEmailView } from "./invite-email.mapper";
import { validateInviteEmailCreateInput, validateInviteEmailListFilter } from "./invite-email.validator";
import type { InviteEmailCreateInput, InviteEmailListFilter, InviteEmailServiceContext, InviteEmailView } from "./invite-email.model";

export interface InviteEmailServiceDeps {
  repository?: InviteEmailRepository | undefined;
}

function resolveRepository(deps?: InviteEmailServiceDeps): InviteEmailRepository {
  return deps?.repository ?? defaultRepository;
}

function getTenantId(context: InviteEmailServiceContext): string {
  return requireTenantId(context.tenantContext);
}

function getActorId(context: InviteEmailServiceContext): string {
  const auth = requireAuth(context.authContext);
  const userId = auth.user?.id?.trim();
  if (!userId) {
    throw new Error("authenticated user id is required");
  }
  return userId;
}

function assertPermission(context: InviteEmailServiceContext, permission: string): void {
  requirePermission(context.authContext, permission);
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function toRecord(input: InviteEmailCreateInput, actorId: string) {
  const now = new Date();
  return {
    id: newId(),
    tenantId: input.tenantId,
    inviteId: input.inviteId,
    email: input.email,
    role: input.role,
    inviteUrl: input.inviteUrl,
    subject: input.subject,
    text: input.text,
    html: input.html,
    status: "SENT" as const,
    messageId: newId(),
    createdBy: input.createdBy ?? actorId,
    createdAt: now,
    updatedAt: now,
    sentAt: now,
  };
}

export async function sendInviteEmail(
  input: unknown,
  context: InviteEmailServiceContext,
  deps?: InviteEmailServiceDeps,
): Promise<InviteEmailView> {
  assertPermission(context, inviteEmailPermissions.send);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const actorId = getActorId(context);
  const payload = validateInviteEmailCreateInput(input);
  if (payload.tenantId !== tenantId) {
    throw new Error("invite email tenant mismatch");
  }
  const record = await repository.create(toRecord(payload, actorId));
  return toInviteEmailView(record) as InviteEmailView;
}

export async function listInviteEmails(
  context: InviteEmailServiceContext,
  deps?: InviteEmailServiceDeps,
  filter?: InviteEmailListFilter,
): Promise<InviteEmailView[]> {
  assertPermission(context, inviteEmailPermissions.read);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  const records = await repository.list(tenantId, validateInviteEmailListFilter(filter));
  return records.map((record) => toInviteEmailView(record) as InviteEmailView);
}

export async function getInviteEmail(
  id: string,
  context: InviteEmailServiceContext,
  deps?: InviteEmailServiceDeps,
): Promise<InviteEmailView | null> {
  assertPermission(context, inviteEmailPermissions.read);
  const repository = resolveRepository(deps);
  const tenantId = getTenantId(context);
  return toInviteEmailView(await repository.getById(tenantId, id));
}
