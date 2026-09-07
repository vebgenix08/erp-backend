import { BadRequestError } from "@school-erp/errors";
import type { EmailDeliveryEventRecord, EmailDeliveryEventType } from "./delivery-events.model";
import {
  createEmailDeliveryEventRepository,
  type EmailDeliveryEventRepository,
} from "./delivery-events.repository";

const EVENT_TYPES: Record<string, EmailDeliveryEventType> = {
  "Email Sent": "SEND",
  "Email Delivered": "DELIVERY",
  "Email Delivery Delayed": "DELIVERY_DELAY",
  "Email Bounced": "BOUNCE",
  "Email Complaint Received": "COMPLAINT",
  "Email Rejected": "REJECT",
  "Email Rendering Failed": "RENDERING_FAILURE",
};

export interface SesEventBridgeEvent {
  id?: string;
  time?: string;
  "detail-type"?: string;
  detail?: Record<string, unknown>;
}

function mailTag(mail: Record<string, unknown>, name: string): string | undefined {
  const tags = mail.tags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return undefined;
  const value = (tags as Record<string, unknown>)[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    );
    return first?.trim();
  }
  return undefined;
}
export async function recordSesDeliveryEvent(
  event: SesEventBridgeEvent,
  repository?: EmailDeliveryEventRepository,
): Promise<EmailDeliveryEventRecord> {
  const eventType = EVENT_TYPES[event["detail-type"] ?? ""];
  if (!event.id || !eventType || !event.detail)
    throw new BadRequestError("invalid SES EventBridge event");
  const target = repository ?? (await createEmailDeliveryEventRepository());
  const existing = await target.getById(event.id);
  if (existing) return existing;
  const mail =
    typeof event.detail.mail === "object" && event.detail.mail
      ? (event.detail.mail as Record<string, unknown>)
      : {};
  const destination = Array.isArray(mail.destination)
    ? mail.destination.filter((value): value is string => typeof value === "string")
    : [];
  const tenantId = mailTag(mail, "tenantId");
  const record: EmailDeliveryEventRecord = {
    id: event.id,
    ...(tenantId ? { tenantId } : {}),
    messageId: typeof mail.messageId === "string" ? mail.messageId : "unknown",
    eventType,
    occurredAt: event.time ? new Date(event.time) : new Date(),
    recipients: destination,
    provider: "SES",
    payload: event.detail,
    createdAt: new Date(),
  };
  return target.create(record);
}

export async function listSesDeliveryEvents(
  email: string,
  tenantId?: string,
  repository?: EmailDeliveryEventRepository,
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@"))
    throw new BadRequestError("valid email is required");
  const target = repository ?? (await createEmailDeliveryEventRepository());
  const normalizedTenantId = tenantId?.trim();
  return (await target.listByRecipient(normalized, normalizedTenantId)).map((record) => ({
    id: record.id,
    ...(record.tenantId ? { tenantId: record.tenantId } : {}),
    messageId: record.messageId,
    eventType: record.eventType,
    occurredAt: record.occurredAt.toISOString(),
    recipients: record.recipients,
  }));
}
