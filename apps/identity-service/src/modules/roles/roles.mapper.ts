import type { RoleRecord } from "./roles.model";

export interface RoleView {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | undefined;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toRoleView(record: RoleRecord | null): RoleView | null {
  if (!record) return null;
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
