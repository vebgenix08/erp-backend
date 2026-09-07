import { internalServiceInvoker, type InternalServiceInvoker } from "@school-erp/service-client";

export interface EmployeeDeliveryEvent {
  id: string;
  messageId: string;
  eventType:
    | "SEND"
    | "DELIVERY"
    | "DELIVERY_DELAY"
    | "BOUNCE"
    | "COMPLAINT"
    | "REJECT"
    | "RENDERING_FAILURE";
  occurredAt: Date;
  recipients: string[];
}

interface DeliveryEventResponse extends Omit<EmployeeDeliveryEvent, "occurredAt"> {
  occurredAt: string;
}

export interface EmployeeDeliveryEventRepository {
  listByRecipient(
    tenantId: string,
    email: string,
    limit?: number,
  ): Promise<EmployeeDeliveryEvent[]>;
}

export class CommsEmployeeDeliveryEventRepository implements EmployeeDeliveryEventRepository {
  constructor(
    private readonly functionName: string,
    private readonly invoker: InternalServiceInvoker = internalServiceInvoker(),
  ) {}

  async listByRecipient(tenantId: string, email: string, limit = 50) {
    const records = await this.invoker.invoke<
      { tenantId: string; email: string; limit: number },
      DeliveryEventResponse[]
    >(this.functionName, {
      operation: "LIST_EMAIL_DELIVERY_EVENTS",
      payload: { tenantId, email: email.trim().toLowerCase(), limit },
    });
    return records.map((record) => ({
      ...record,
      occurredAt: new Date(record.occurredAt),
    }));
  }
}

function runtimeEnv() {
  return (
    (
      globalThis as unknown as {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env ?? {}
  );
}

let singleton: Promise<EmployeeDeliveryEventRepository> | undefined;

export async function createEmployeeDeliveryEventRepository() {
  const functionName = runtimeEnv().COMMS_FUNCTION_NAME?.trim();
  if (!functionName) throw new Error("COMMS_FUNCTION_NAME is not configured");
  return new CommsEmployeeDeliveryEventRepository(functionName);
}

export function employeeDeliveryEventRepository() {
  return (singleton ??= createEmployeeDeliveryEventRepository());
}
