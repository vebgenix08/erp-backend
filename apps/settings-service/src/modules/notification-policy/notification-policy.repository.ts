import { createMongoCollectionAdapter, getCollection, type CollectionAdapter, type MongoEnvLike } from "@school-erp/mongodb";
import { DEFAULT_NOTIFICATION_EVENTS, type NotificationPolicyInput, type NotificationPolicyRecord } from "./notification-policy.model";

interface NotificationPolicyDocument extends NotificationPolicyRecord { _id: string; }
export interface NotificationPolicyRepository { get(tenantId: string): Promise<NotificationPolicyRecord | null>; save(tenantId: string, input: NotificationPolicyInput): Promise<NotificationPolicyRecord>; }
function clone(record: NotificationPolicyRecord): NotificationPolicyRecord { return { ...record, events: record.events.map((event) => ({ ...event })), createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) }; }
export function defaultNotificationPolicy(tenantId: string): NotificationPolicyRecord { const now = new Date(); return { id: `notification_policy_${tenantId}`, tenantId, emailEnabled: true, smsEnabled: false, timezone: "Asia/Kolkata", events: DEFAULT_NOTIFICATION_EVENTS.map((event) => ({ ...event })), createdAt: now, updatedAt: now }; }

export class InMemoryNotificationPolicyRepository implements NotificationPolicyRepository {
  private readonly records = new Map<string, NotificationPolicyRecord>();
  async get(tenantId: string) { const value = this.records.get(tenantId); return value ? clone(value) : null; }
  async save(tenantId: string, input: NotificationPolicyInput) { const current = this.records.get(tenantId) ?? defaultNotificationPolicy(tenantId); const saved = clone({ ...current, ...input, events: input.events.map((event) => ({ ...event })), updatedAt: new Date() }); this.records.set(tenantId, saved); return clone(saved); }
}

export class MongoNotificationPolicyRepository implements NotificationPolicyRepository {
  constructor(private readonly collection: CollectionAdapter<NotificationPolicyDocument>) {}
  async get(tenantId: string) { const document = await this.collection.findOne({ tenantId }); if (!document) return null; const { _id, ...record } = document; return clone({ ...record, id: record.id || _id }); }
  async save(tenantId: string, input: NotificationPolicyInput) { const current = await this.get(tenantId) ?? defaultNotificationPolicy(tenantId); const saved = clone({ ...current, ...input, events: input.events.map((event) => ({ ...event })), updatedAt: new Date() }); const document = { ...saved, _id: saved.id }; if (await this.get(tenantId)) await this.collection.replaceOne({ tenantId }, document); else await this.collection.insertOne(document); return saved; }
}

function runtimeEnv(): MongoEnvLike { return (globalThis as unknown as { process?: { env?: MongoEnvLike } }).process?.env ?? {}; }
let singleton: Promise<NotificationPolicyRepository> | undefined;
export async function createNotificationPolicyRepository(env: MongoEnvLike = runtimeEnv()): Promise<NotificationPolicyRepository> { if (!env.MONGODB_URI && !env.MONGODB_URI_DEV && !env.MONGODB_URI_PROD && !env.MONGODB_URI_TEST) return new InMemoryNotificationPolicyRepository(); const collection = await getCollection<NotificationPolicyDocument>("settings_notification_policies", env); await collection.createIndex({ tenantId: 1 }, { unique: true }); return new MongoNotificationPolicyRepository(createMongoCollectionAdapter(collection)); }
async function repository() { return singleton ??= createNotificationPolicyRepository(); }
export const notificationPolicyRepository: NotificationPolicyRepository = { get: async (...args) => (await repository()).get(...args), save: async (...args) => (await repository()).save(...args) };
