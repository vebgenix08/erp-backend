import { BadRequestError } from "@school-erp/errors";
import type {
  EmailDeliveryEventRecord,
  EmailDeliveryEventType,
} from "./delivery-events.model";
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
    ? mail.destination.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const record: EmailDeliveryEventRecord = {
    id: event.id,
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
  repository?: EmailDeliveryEventRepository,
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@"))
    throw new BadRequestError("valid email is required");
  const target = repository ?? (await createEmailDeliveryEventRepository());
  return (await target.listByRecipient(normalized)).map((record) => ({
    id: record.id,
    messageId: record.messageId,
    eventType: record.eventType,
    occurredAt: record.occurredAt.toISOString(),
    recipients: record.recipients,
  }));
}
