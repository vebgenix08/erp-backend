import type { UserRecord } from "./users.model";

export interface UserView {
  id: string;
  tenantId: string;
  authUserId?: string | undefined;
  email: string;
  name: string;
  status: UserRecord["status"];
  createdAt: string;
  updatedAt: string;
  deactivatedAt?: string | undefined;
}

export function toUserView(record: UserRecord | null): UserView | null {
  if (!record) return null;
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deactivatedAt: record.deactivatedAt?.toISOString(),
  };
}
