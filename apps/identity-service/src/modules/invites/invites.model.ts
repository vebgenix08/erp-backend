import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type InviteStatus = "PENDING" | "SENT" | "ACCEPTED" | "REVOKED" | "EXPIRED";
export type InviteDeliveryStatus = "QUEUED" | "SENT" | "FAILED";

export interface InviteRecord {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  fullName?: string | undefined;
  status: InviteStatus;
  token: string;
  inviteUrl: string;
  expiresAt: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date | undefined;
  acceptedAt?: Date | undefined;
  revokedAt?: Date | undefined;
  deliveryStatus: InviteDeliveryStatus;
  deliveryMessageId?: string | undefined;
  deliveryError?: string | undefined;
  lastSentAt?: Date | undefined;
  resendCount: number;
}

export interface InviteView {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  fullName?: string | undefined;
  status: InviteStatus;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | undefined;
  acceptedAt?: string | undefined;
  revokedAt?: string | undefined;
  deliveryStatus: InviteDeliveryStatus;
  deliveryMessageId?: string | undefined;
  deliveryError?: string | undefined;
  lastSentAt?: string | undefined;
  resendCount: number;
}

export interface InviteCreateInput {
  email: string;
  role: string;
  fullName?: string | undefined;
  expiresInDays?: number | undefined;
  message?: string | undefined;
}

export interface InviteUpdateInput {
  fullName?: string | undefined;
  role?: string | undefined;
}

export interface InviteListFilter {
  search?: string | undefined;
  status?: InviteStatus | undefined;
  role?: string | undefined;
}

export interface InviteServiceContext {
  tenantContext: TenantContext;
  authContext: AuthContext;
  requestId: string;
  baseUrl?: string | undefined;
}

export interface InviteServiceDeliveryMessage {
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

export interface InviteServiceDeliveryReceipt {
  messageId: string;
  sentAt: Date;
  provider: "memory";
}

export interface InviteDeliveryPort {
  sendInviteEmail(message: InviteServiceDeliveryMessage): Promise<InviteServiceDeliveryReceipt>;
}
