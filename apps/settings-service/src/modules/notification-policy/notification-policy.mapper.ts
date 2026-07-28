import type { NotificationPolicyRecord, NotificationPolicyView } from "./notification-policy.model";
export function toNotificationPolicyView(record: NotificationPolicyRecord): NotificationPolicyView {
  return { ...record, events: record.events.map((event) => ({ ...event })), createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}
