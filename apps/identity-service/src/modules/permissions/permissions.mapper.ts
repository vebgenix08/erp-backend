import type { PermissionRecord } from "./permissions.model";

export interface PermissionView {
  id: string;
  tenantId: string;
  code: string;
  description?: string | undefined;
  category?: string | undefined;
  isSystemPermission: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPermissionView(record: PermissionRecord | null): PermissionView | null {
  if (!record) return null;
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
