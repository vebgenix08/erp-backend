import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type InviteEmailStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "DELAYED"
  | "BOUNCED"
  | "COMPLAINED"
  | "REJECTED"
  | "FAILED";

export interface InviteEmailRecord {
  id: string;
  tenantId: string;
  inviteId: string;
  email: string;
  role: string;
  inviteUrl: string;
  subject: string;
  text: string;
  html: string;
  status: InviteEmailStatus;
  messageId?: string | undefined;
  createdBy?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date | undefined;
  errorMessage?: string | undefined;
}

export interface InviteEmailView {
  id: string;
  tenantId: string;
  inviteId: string;
  email: string;
  role: string;
  inviteUrl: string;
  subject: string;
  text: string;
  html: string;
  status: InviteEmailStatus;
  messageId?: string | undefined;
  createdBy?: string | undefined;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | undefined;
  errorMessage?: string | undefined;
}

export interface InviteEmailCreateInput {
  inviteId: string;
  tenantId: string;
  email: string;
  role: string;
  inviteUrl: string;
  subject: string;
  text: string;
  html: string;
  createdBy?: string | undefined;
}

export interface InviteEmailListFilter {
  search?: string | undefined;
  status?: InviteEmailStatus | undefined;
}

export interface InviteEmailServiceContext {
  requestId: string;
  tenantContext: TenantContext;
  authContext: AuthContext;
}
