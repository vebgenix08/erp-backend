import type { RoleRecord } from "./roles.model";

export function toRoleView(record: RoleRecord | null) {
  return record ? { ...record } : null;
}
