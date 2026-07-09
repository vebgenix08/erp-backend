import type { UserRecord } from "./users.model";

export function toUserView(record: UserRecord | null) {
  return record ? { ...record } : null;
}
