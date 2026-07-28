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
    record.messageId.toLowerCase().includes(query)
  );
}

export interface InviteEmailRepository {
  list(tenantId: string, filter?: InviteEmailListFilter): Promise<InviteEmailRecord[]>;
  getById(tenantId: string, id: string): Promise<InviteEmailRecord | null>;
  create(input: InviteEmailRecord): Promise<InviteEmailRecord>;
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
}

export const inviteEmailRepository = new InMemoryInviteEmailRepository();
