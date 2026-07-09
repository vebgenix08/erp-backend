import type { InviteRecord } from "./invites.model";

export function toInviteView(record: InviteRecord | null) {
  return record ? { ...record } : null;
}
