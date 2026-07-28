import type { UserStatus } from "@school-erp/types";

export type { UserStatus };

export interface UserRecord {
  id: string;
  tenantId: string;
  authUserId?: string | undefined;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deactivatedAt?: Date | undefined;
}

export interface UserCreateInput {
  authUserId?: string | undefined;
  email: string;
  name: string;
  status?: UserStatus | undefined;
}

export interface UserUpdateInput {
  authUserId?: string | undefined;
  email?: string | undefined;
  name?: string | undefined;
  status?: UserStatus | undefined;
  deactivatedAt?: Date | undefined;
}
