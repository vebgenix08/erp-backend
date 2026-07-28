import type { CollectionAdapter, MongoEnvLike } from "@school-erp/mongodb";
import { createMongoCollectionAdapter, getCollection } from "@school-erp/mongodb";
import type { AuditLogCreateInput, AuditLogRecord } from "./audit-logs.model";

export interface AuditLogFilter { tenantId?: string | undefined; entityType?: string | undefined; action?: string | undefined; limit?: number | undefined; offset?: number | undefined; }
export interface AuditLogRepository {
  list(filter?: AuditLogFilter): Promise<AuditLogRecord[]>;
  create(input: AuditLogCreateInput): Promise<AuditLogRecord>;
}

interface AuditLogDocument extends AuditLogRecord {
  _id: string;
}

function now() {
  return new Date();
}

function clone(record: AuditLogRecord): AuditLogRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    details: record.details ? { ...record.details } : undefined,
  };
}

function toDocument(record: AuditLogRecord): AuditLogDocument {
  return { ...clone(record), _id: record.id };
}

function fromDocument(document: AuditLogDocument | null): AuditLogRecord | null {
  if (!document) return null;
  const { _id, ...record } = document;
  return clone({ ...record, id: record.id || _id });
}

function makeId(): string {
  return `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly records: AuditLogRecord[] = [];

  async list(filter: AuditLogFilter = {}) {
    return this.records
      .filter((record) => {
        if (filter.tenantId && record.tenantId !== filter.tenantId) return false;
        if (filter.entityType && record.entityType !== filter.entityType) return false;
        if (filter.action && record.action !== filter.action) return false;
        return true;
      })
      .map(clone)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 100));
  }

  async create(input: AuditLogCreateInput) {
    const record: AuditLogRecord = {
      id: makeId(),
      actorId: input.actorId?.trim() || undefined,
      tenantId: input.tenantId?.trim() || undefined,
      action: input.action.trim(),
      entityType: input.entityType.trim(),
      entityId: input.entityId?.trim() || undefined,
      details: input.details ? { ...input.details } : undefined,
      createdAt: now(),
    };
    this.records.push(record);
    return clone(record);
  }
}

class MongoAuditLogRepository implements AuditLogRepository {
  constructor(private readonly collection: CollectionAdapter<AuditLogDocument>) {}
  async list(filter: AuditLogFilter = {}) {
    const databaseFilter: Record<string, unknown> = {};
    if (filter.tenantId) databaseFilter.tenantId = filter.tenantId;
    if (filter.entityType) databaseFilter.entityType = filter.entityType;
    if (filter.action) databaseFilter.action = filter.action;
    const records = await this.collection.findMany(databaseFilter, { sort: { createdAt: -1 }, skip: filter.offset ?? 0, limit: filter.limit ?? 100 });
    return records
      .map((record) => fromDocument(record))
      .filter((record): record is AuditLogRecord => record !== null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }
  async create(input: AuditLogCreateInput) {
    const record: AuditLogRecord = {
      id: makeId(),
      actorId: input.actorId?.trim() || undefined,
      tenantId: input.tenantId?.trim() || undefined,
      action: input.action.trim(),
      entityType: input.entityType.trim(),
      entityId: input.entityId?.trim() || undefined,
      details: input.details ? { ...input.details } : undefined,
      createdAt: now(),
    };
    await this.collection.insertOne(toDocument(record));
    return clone(record);
  }
}

function hasMongoEnv(env: MongoEnvLike): boolean {
  return Boolean(env.MONGODB_URI || env.MONGODB_URI_DEV || env.MONGODB_URI_PROD || env.MONGODB_URI_TEST);
}

function getRuntimeEnv(): MongoEnvLike {
  const runtime = globalThis as unknown as { process?: { env?: MongoEnvLike } };
  return runtime.process?.env ?? {};
}

export async function createAuditLogRepository(env: MongoEnvLike = getRuntimeEnv()): Promise<AuditLogRepository> {
  if (!hasMongoEnv(env)) return new InMemoryAuditLogRepository();
  const collection = await getCollection<AuditLogDocument>("platform_audit_logs", env);
  await collection.createIndex({ createdAt: -1 });
  return new MongoAuditLogRepository(createMongoCollectionAdapter(collection));
}

export const auditLogRepository = createAuditLogRepository();
