import type { PermissionRecord } from "./permissions.model";

export function toPermissionView(record: PermissionRecord | null) {
  return record ? { ...record } : null;
}
