import type { InviteEmailCreateInput, InviteEmailListFilter, InviteEmailRecord } from "./invite-email.model";

function clone(record: InviteEmailRecord): InviteEmailRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    sentAt: record.sentAt ? new Date(record.sentAt) : undefined,
  };
}

function matchesSearch(record: InviteEmailRecord, search: string): boolean {
  const query = search.toLowerCase();
  return (
    record.email.toLowerCase().includes(query) ||
    record.role.toLowerCase().includes(query) ||
    record.inviteId.toLowerCase().includes(query) ||
    (record.messageId?.toLowerCase().includes(query) ?? false)
  );
}

export interface InviteEmailRepository {
  list(tenantId: string, filter?: InviteEmailListFilter): Promise<InviteEmailRecord[]>;
  getById(tenantId: string, id: string): Promise<InviteEmailRecord | null>;
  create(input: InviteEmailRecord): Promise<InviteEmailRecord>;
  update(tenantId: string, id: string, input: Partial<InviteEmailRecord>): Promise<InviteEmailRecord>;
  updateByMessageId(messageId: string, input: Partial<InviteEmailRecord>): Promise<InviteEmailRecord | null>;
}

export class InMemoryInviteEmailRepository implements InviteEmailRepository {
  private readonly records = new Map<string, Map<string, InviteEmailRecord>>();

  private tenantBucket(tenantId: string): Map<string, InviteEmailRecord> {
    let bucket = this.records.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, InviteEmailRecord>();
      this.records.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter: InviteEmailListFilter = {}): Promise<InviteEmailRecord[]> {
    return [...this.tenantBucket(tenantId).values()]
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .map(clone);
  }

  async getById(tenantId: string, id: string): Promise<InviteEmailRecord | null> {
    const record = this.tenantBucket(tenantId).get(id);
    return record ? clone(record) : null;
  }

  async create(input: InviteEmailRecord): Promise<InviteEmailRecord> {
    const record = clone(input);
    this.tenantBucket(record.tenantId).set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: Partial<InviteEmailRecord>): Promise<InviteEmailRecord> {
    const current = this.tenantBucket(tenantId).get(id);
    if (!current) throw new Error("invite email was not found");
    const record = clone({ ...current, ...input, id: current.id, tenantId: current.tenantId });
    this.tenantBucket(tenantId).set(id, record);
    return clone(record);
  }
  async updateByMessageId(messageId: string, input: Partial<InviteEmailRecord>): Promise<InviteEmailRecord | null> {
    for (const bucket of this.records.values()) {
      const current = [...bucket.values()].find((record) => record.messageId === messageId);
      if (current) return this.update(current.tenantId, current.id, input);
    }
    return null;
  }
}

interface InviteEmailDocument extends InviteEmailRecord { _id: string }

export class MongoInviteEmailRepository implements InviteEmailRepository {
  constructor(private readonly collection: import("@school-erp/mongodb").CollectionAdapter<InviteEmailDocument>) {}
  async list(tenantId: string, filter: InviteEmailListFilter = {}) {
    const query: Record<string, unknown> = { tenantId };
    if (filter.status) query.status = filter.status;
    const records = await this.collection.findMany(query as never, { sort: { createdAt: -1 }, limit: 200 });
    return records.map(({ _id: _ignored, ...record }) => record).filter((record) => !filter.search || matchesSearch(record, filter.search));
  }
  async getById(tenantId: string, id: string) {
    const document = await this.collection.findOne({ tenantId, _id: id } as never);
    if (!document) return null;
    const { _id: _ignored, ...record } = document;
    return record;
  }
  async create(input: InviteEmailRecord) {
    await this.collection.insertOne({ ...input, _id: input.id });
    return input;
  }
  async update(tenantId: string, id: string, input: Partial<InviteEmailRecord>) {
    const updatedDocument = await this.collection.findOneAndUpdate({ tenantId, _id: id } as never, { $set: input } as never);
    const updated = updatedDocument ? await this.getById(tenantId, id) : null;
    if (!updated) throw new Error("invite email was not found");
    return updated;
  }
  async updateByMessageId(messageId: string, input: Partial<InviteEmailRecord>) {
    const document = await this.collection.findOneAndUpdate({ messageId } as never, { $set: input } as never);
    if (!document) return null;
    const { _id: _ignored, ...record } = document;
    return record;
  }
}

let runtimeRepository: Promise<InviteEmailRepository> | undefined;
export async function createInviteEmailRepository(): Promise<InviteEmailRepository> {
  const { createMongoCollectionAdapter, getCollection } = await import("@school-erp/mongodb");
  const collection = await getCollection<InviteEmailDocument>("comms_invite_emails");
  await collection.createIndex({ tenantId: 1, createdAt: -1 });
  await collection.createIndex({ messageId: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ tenantId: 1, inviteId: 1, createdAt: -1 });
  return new MongoInviteEmailRepository(createMongoCollectionAdapter(collection));
}
export function inviteEmailRepository(): Promise<InviteEmailRepository> {
  runtimeRepository ??= createInviteEmailRepository();
  return runtimeRepository;
}
