import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import {
  createMongoCollectionAdapter,
  getCollection,
} from "@school-erp/mongodb";
import type { EmailDeliveryEventRecord } from "./delivery-events.model";

interface EmailDeliveryEventDocument extends EmailDeliveryEventRecord {
  _id: string;
}
export interface EmailDeliveryEventRepository {
  getById(id: string): Promise<EmailDeliveryEventRecord | null>;
  listByRecipient(
    email: string,
    limit?: number,
  ): Promise<EmailDeliveryEventRecord[]>;
  create(record: EmailDeliveryEventRecord): Promise<EmailDeliveryEventRecord>;
}

export class InMemoryEmailDeliveryEventRepository
  implements EmailDeliveryEventRepository
{
  private readonly records = new Map<string, EmailDeliveryEventRecord>();
  async getById(id: string) {
    return this.records.get(id) ?? null;
  }
  async listByRecipient(email: string, limit = 50) {
    return [...this.records.values()]
      .filter((record) => record.recipients.includes(email))
      .sort(
        (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
      )
      .slice(0, limit);
  }
  async create(record: EmailDeliveryEventRecord) {
    this.records.set(record.id, record);
    return record;
  }
}

export class MongoEmailDeliveryEventRepository
  implements EmailDeliveryEventRepository
{
  constructor(
    private readonly collection: CollectionAdapter<EmailDeliveryEventDocument>,
  ) {}
  async getById(id: string) {
    return this.collection.findOne({ _id: id });
  }
  async listByRecipient(email: string, limit = 50) {
    return (
      await this.collection.findMany({ recipients: email } as never, {
        sort: { occurredAt: -1 },
        limit,
      })
    ).map(({ _id: _id, ...record }) => record);
  }
  async create(record: EmailDeliveryEventRecord) {
    await this.collection.insertOne({ ...record, _id: record.id });
    return record;
  }
}

function runtimeEnv(): MongoEnvLike {
  return (
    (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process
      ?.env ?? {}
  );
}
export async function createEmailDeliveryEventRepository(
  env: MongoEnvLike = runtimeEnv(),
): Promise<EmailDeliveryEventRepository> {
  const collection = await getCollection<EmailDeliveryEventDocument>(
    "comms_email_delivery_events",
    env,
  );
  await collection.createIndex({ messageId: 1, occurredAt: -1 });
  await collection.createIndex({ eventType: 1, occurredAt: -1 });
  return new MongoEmailDeliveryEventRepository(
    createMongoCollectionAdapter(collection),
  );
}
