import {
  recordSesDeliveryEvent,
  type SesEventBridgeEvent,
} from "../modules/delivery-events/delivery-events.service";
import { createLogger } from "@school-erp/logger";
import { hydrateCommsRuntimeConfig } from "./runtime-config";
import { applyInviteEmailProviderEvent } from "../modules/invite-email/invite-email.service";

interface SqsRecord {
  messageId: string;
  body: string;
}
interface SqsEvent {
  Records?: SqsRecord[];
}
export async function handler(event: SqsEvent) {
  const logger = createLogger("comms-service");
  await hydrateCommsRuntimeConfig();
  const failures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records ?? []) {
    try {
      const deliveryEvent = await recordSesDeliveryEvent(
        JSON.parse(record.body) as SesEventBridgeEvent,
      );
      await applyInviteEmailProviderEvent(deliveryEvent.messageId, deliveryEvent.eventType);
      logger.info("SES delivery event recorded", { requestId: record.messageId });
    } catch (error) {
      logger.error("SES delivery event processing failed", {
        requestId: record.messageId,
        error: error instanceof Error ? error.message : "unknown error",
      });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}
