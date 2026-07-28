import { BadRequestError } from "@school-erp/errors";
import { DEFAULT_NOTIFICATION_EVENTS, type NotificationAudience, type NotificationEvent, type NotificationPolicyInput } from "./notification-policy.model";

const events = new Set<NotificationEvent>(DEFAULT_NOTIFICATION_EVENTS.map((item) => item.event));
const audiences = new Set<NotificationAudience>(["TENANT_ADMINS", "APPLICANT", "PARENT_STUDENT", "STAFF_MEMBER"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalEmail(value: unknown, field: string): string | undefined {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized && !emailPattern.test(normalized)) throw new BadRequestError(`${field} must be a valid email`);
  return normalized || undefined;
}

export function validateNotificationPolicy(input: unknown): NotificationPolicyInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestError("notification policy input is required");
  const value = input as Record<string, unknown>;
  const timezone = typeof value.timezone === "string" ? value.timezone.trim() : "";
  if (!timezone || timezone.length > 64) throw new BadRequestError("timezone is required");
  if (!Array.isArray(value.events)) throw new BadRequestError("events are required");
  const seen = new Set<NotificationEvent>();
  const mapped = value.events.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new BadRequestError("notification event is invalid");
    const eventValue = item as Record<string, unknown>;
    const event = String(eventValue.event ?? "").toUpperCase() as NotificationEvent;
    const audience = String(eventValue.audience ?? "").toUpperCase() as NotificationAudience;
    if (!events.has(event) || seen.has(event)) throw new BadRequestError("notification event is invalid or duplicated");
    if (!audiences.has(audience)) throw new BadRequestError("notification audience is invalid");
    seen.add(event);
    return { event, label: DEFAULT_NOTIFICATION_EVENTS.find((entry) => entry.event === event)?.label ?? event, audience, email: eventValue.email === true, sms: eventValue.sms === true };
  });
  if (mapped.length !== DEFAULT_NOTIFICATION_EVENTS.length) throw new BadRequestError("all supported notification events are required");
  return {
    adminEmail: optionalEmail(value.adminEmail, "adminEmail"),
    replyToEmail: optionalEmail(value.replyToEmail, "replyToEmail"),
    emailEnabled: value.emailEnabled !== false,
    smsEnabled: value.smsEnabled === true,
    timezone,
    events: mapped,
  };
}
