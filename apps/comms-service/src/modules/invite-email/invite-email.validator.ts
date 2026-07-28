import { BadRequestError } from "@school-erp/errors";
import type { InviteEmailCreateInput, InviteEmailListFilter } from "./invite-email.model";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateInviteEmailCreateInput(input: unknown): InviteEmailCreateInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("invite email input is required");
  }
  const value = input as Record<string, unknown>;
  const inviteId = asString(value.inviteId);
  const tenantId = asString(value.tenantId);
  const email = asString(value.email);
  const role = asString(value.role);
  const inviteUrl = asString(value.inviteUrl);
  const subject = asString(value.subject);
  const text = asString(value.text);
  const html = asString(value.html);
  const createdBy = asString(value.createdBy);

  if (!inviteId) throw new BadRequestError("inviteId is required");
  if (!tenantId) throw new BadRequestError("tenantId is required");
  if (!email) throw new BadRequestError("email is required");
  if (!role) throw new BadRequestError("role is required");
  if (!inviteUrl) throw new BadRequestError("inviteUrl is required");
  if (!subject) throw new BadRequestError("subject is required");
  if (!text) throw new BadRequestError("text is required");
  if (!html) throw new BadRequestError("html is required");

  return {
    inviteId,
    tenantId,
    email,
    role,
    inviteUrl,
    subject,
    text,
    html,
    createdBy: createdBy || undefined,
  };
}

export function validateInviteEmailListFilter(input: unknown): InviteEmailListFilter {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestError("invite email filter must be an object");
  }
  const value = input as Record<string, unknown>;
  const filter: InviteEmailListFilter = {};
  const search = asString(value.search);
  const status = asString(value.status).toUpperCase();
  if (search) filter.search = search;
  if (status) {
    if (status !== "QUEUED" && status !== "SENT" && status !== "FAILED") {
      throw new BadRequestError("invalid invite email status");
    }
    filter.status = status;
  }
  return filter;
}
