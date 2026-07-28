import type { RequestContext } from "@school-erp/api";

export type BootstrapStatus = "PENDING" | "INVITED" | "COMPLETED" | "FAILED";

export interface FirstAdminBootstrapRecord {
  id: string;
  tenantId: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string | undefined;
  roleCode: "TENANT_ADMIN";
  status: BootstrapStatus;
  inviteId?: string | undefined;
  inviteError?: string | undefined;
  inviteAttempts: number;
  lastInviteAttemptAt?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
  invitedAt?: Date | undefined;
  completedAt?: Date | undefined;
}

export interface FirstAdminBootstrapView {
  id: string;
  tenantId: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string | undefined;
  roleCode: "TENANT_ADMIN";
  status: BootstrapStatus;
  inviteId?: string | undefined;
  inviteError?: string | undefined;
  inviteAttempts: number;
  lastInviteAttemptAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
  invitedAt?: string | undefined;
  completedAt?: string | undefined;
}

export interface FirstAdminBootstrapCreateInput {
  tenantId: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string | undefined;
}

export interface FirstAdminBootstrapCompleteInput {
  inviteId?: string | undefined;
}

export interface FirstAdminInviteRequest {
  tenantId: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string | undefined;
  roleCode: "TENANT_ADMIN";
  requestId: string;
}

export interface FirstAdminInviteReceipt {
  inviteId: string;
  sentAt: Date;
}

export interface FirstAdminBootstrapServiceContext {
  requestId: string;
  tenantContext: RequestContext["tenantContext"];
  authContext: RequestContext["authContext"];
}
