import type { AuthContext } from "@school-erp/auth";
import type { TenantContext } from "@school-erp/tenancy";

export type CognitoSyncStatus = "PENDING" | "SYNCED" | "FAILED" | "DISABLED";

export interface CognitoSyncRecord {
  id: string;
  tenantId: string;
  userId: string;
  cognitoUsername?: string | undefined;
  email: string;
  status: CognitoSyncStatus;
  lastSyncedAt?: Date | undefined;
  errorMessage?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CognitoSyncView {
  id: string;
  tenantId: string;
  userId: string;
  cognitoUsername?: string | undefined;
  email: string;
  status: CognitoSyncStatus;
  lastSyncedAt?: string | undefined;
  errorMessage?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface CognitoSyncCreateInput {
  userId: string;
  email: string;
  cognitoUsername?: string | undefined;
}

export interface CognitoSyncUpdateInput {
  cognitoUsername?: string | undefined;
  status?: CognitoSyncStatus | undefined;
  errorMessage?: string | undefined;
  lastSyncedAt?: Date | undefined;
}

export interface CognitoSyncListFilter {
  search?: string | undefined;
  status?: CognitoSyncStatus | undefined;
}

export interface CognitoSyncServiceContext {
  tenantContext: TenantContext;
  authContext: AuthContext;
  requestId: string;
}
