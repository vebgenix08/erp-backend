export type EmailDeliveryEventType =
  | "SEND"
  | "DELIVERY"
  | "DELIVERY_DELAY"
  | "BOUNCE"
  | "COMPLAINT"
  | "REJECT"
  | "RENDERING_FAILURE";

export interface EmailDeliveryEventRecord {
  id: string;
  messageId: string;
  eventType: EmailDeliveryEventType;
  occurredAt: Date;
  recipients: string[];
  provider: "SES";
  payload: Record<string, unknown>;
  createdAt: Date;
}
