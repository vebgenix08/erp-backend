import { requireAuth, requirePermission } from "@school-erp/auth";
import { requireTenantId } from "@school-erp/tenancy";
import { inviteEmailRepository as runtimeRepository, type InviteEmailRepository } from "./invite-email.repository";
import { createRuntimeInviteEmailProvider, type InviteEmailProvider } from "./invite-email.provider";
import { inviteEmailPermissions } from "./invite-email.permissions";
import { toInviteEmailView } from "./invite-email.mapper";
import { validateInviteEmailCreateInput, validateInviteEmailListFilter } from "./invite-email.validator";
import type { InviteEmailCreateInput, InviteEmailListFilter, InviteEmailServiceContext, InviteEmailView } from "./invite-email.model";
import type { EmailDeliveryEventType } from "../delivery-events/delivery-events.model";

export interface InviteEmailServiceDeps {
  repository?: InviteEmailRepository | undefined;
  provider?: InviteEmailProvider | undefined;
}

async function resolveRepository(deps?: InviteEmailServiceDeps): Promise<InviteEmailRepository> {
  return deps?.repository ?? runtimeRepository();
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
    status: "QUEUED" as const,
    createdBy: input.createdBy ?? actorId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function sendInviteEmail(
  input: unknown,
  context: InviteEmailServiceContext,
  deps?: InviteEmailServiceDeps,
): Promise<InviteEmailView> {
  assertPermission(context, inviteEmailPermissions.send);
  const repository = await resolveRepository(deps);
  const tenantId = getTenantId(context);
  const actorId = getActorId(context);
  const payload = validateInviteEmailCreateInput(input);
  if (payload.tenantId !== tenantId) {
    throw new Error("invite email tenant mismatch");
  }
  const queued = await repository.create(toRecord(payload, actorId));
  try {
    const provider = deps?.provider ?? createRuntimeInviteEmailProvider();
    const result = await provider.send(payload);
    const now = new Date();
    const sent = await repository.update(tenantId, queued.id, { status: "SENT", messageId: result.messageId, sentAt: now, updatedAt: now, errorMessage: undefined });
    return toInviteEmailView(sent) as InviteEmailView;
  } catch (error) {
    const now = new Date();
    await repository.update(tenantId, queued.id, { status: "FAILED", updatedAt: now, errorMessage: error instanceof Error ? error.message : "email provider failed" });
    throw error;
  }
}

export async function listInviteEmails(
  context: InviteEmailServiceContext,
  deps?: InviteEmailServiceDeps,
  filter?: InviteEmailListFilter,
): Promise<InviteEmailView[]> {
  assertPermission(context, inviteEmailPermissions.read);
  const repository = await resolveRepository(deps);
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
  const repository = await resolveRepository(deps);
  const tenantId = getTenantId(context);
  return toInviteEmailView(await repository.getById(tenantId, id));
}

const providerStatus: Partial<Record<EmailDeliveryEventType, import("./invite-email.model").InviteEmailStatus>> = {
  SEND: "SENT",
  DELIVERY: "DELIVERED",
  DELIVERY_DELAY: "DELAYED",
  BOUNCE: "BOUNCED",
  COMPLAINT: "COMPLAINED",
  REJECT: "REJECTED",
  RENDERING_FAILURE: "FAILED",
};

export async function applyInviteEmailProviderEvent(messageId: string, eventType: EmailDeliveryEventType, deps?: InviteEmailServiceDeps): Promise<void> {
  if (!messageId || messageId === "unknown") return;
  const status = providerStatus[eventType];
  if (!status) return;
  const repository = await resolveRepository(deps);
  await repository.updateByMessageId(messageId, { status, updatedAt: new Date(), errorMessage: ["BOUNCED", "COMPLAINED", "REJECTED", "FAILED"].includes(status) ? `SES reported ${eventType.toLowerCase()}` : undefined });
}
