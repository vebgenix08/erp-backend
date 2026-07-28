import type { StudentEnrolledEvent, StudentEnrollmentChangedEvent } from "@school-erp/events";
import { generateFeeOrderFromEnrollment } from "../modules/fee-orders/fee-orders.service";
import { hydrateFinanceRuntimeConfig } from "./runtime-config";
import { recordFeeOrderFailure, resolveFeeOrderRecoveryForEvent } from "../modules/fee-order-recovery/fee-order-recovery.service";

interface EventBridgeEnvelope { detail: StudentEnrolledEvent | StudentEnrollmentChangedEvent; }

export async function handler(event: EventBridgeEnvelope): Promise<void> {
  await hydrateFinanceRuntimeConfig();
  const domainEvent = event.detail;
  if (!["academics.student.enrolled.v1", "academics.student.enrollment-changed.v1"].includes(domainEvent.type) || domainEvent.source !== "erp.academics") throw new Error("unsupported academics event");
  try {
    await generateFeeOrderFromEnrollment(domainEvent.data, domainEvent.tenantId);
    await resolveFeeOrderRecoveryForEvent(domainEvent.tenantId, domainEvent.id, "system:eventbridge");
  } catch (error) {
    await recordFeeOrderFailure(domainEvent.tenantId, domainEvent.id, domainEvent.data, error);
    throw error;
  }
}
