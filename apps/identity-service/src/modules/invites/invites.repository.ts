import type { InviteListFilter, InviteRecord, InviteStatus, InviteUpdateInput } from "./invites.model";

function clone(record: InviteRecord): InviteRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    expiresAt: new Date(record.expiresAt),
    sentAt: record.sentAt ? new Date(record.sentAt) : undefined,
    acceptedAt: record.acceptedAt ? new Date(record.acceptedAt) : undefined,
    revokedAt: record.revokedAt ? new Date(record.revokedAt) : undefined,
    lastSentAt: record.lastSentAt ? new Date(record.lastSentAt) : undefined,
  };
}

function matchesSearch(record: InviteRecord, search: string): boolean {
  const query = search.toLowerCase();
  return (
    record.email.toLowerCase().includes(query) ||
    record.role.toLowerCase().includes(query) ||
    (record.fullName?.toLowerCase().includes(query) ?? false) ||
    record.token.toLowerCase().includes(query)
  );
}

export interface InviteRepository {
  list(tenantId: string, filter?: InviteListFilter): Promise<InviteRecord[]>;
  getById(tenantId: string, id: string): Promise<InviteRecord | null>;
  findByEmail(tenantId: string, email: string): Promise<InviteRecord | null>;
  findByToken(tenantId: string, token: string): Promise<InviteRecord | null>;
  create(tenantId: string, input: InviteRecord): Promise<InviteRecord>;
  update(tenantId: string, id: string, input: InviteUpdateInput & Partial<InviteRecord>): Promise<InviteRecord | null>;
}

export class InMemoryInviteRepository implements InviteRepository {
  private readonly records = new Map<string, Map<string, InviteRecord>>();

  private tenantBucket(tenantId: string): Map<string, InviteRecord> {
    let bucket = this.records.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, InviteRecord>();
      this.records.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter: InviteListFilter = {}): Promise<InviteRecord[]> {
    const values = [...this.tenantBucket(tenantId).values()];
    return values
      .filter((record) => {
        if (filter.status && record.status !== filter.status) return false;
        if (filter.role && record.role !== filter.role) return false;
        if (filter.search && !matchesSearch(record, filter.search)) return false;
        return true;
      })
      .map(clone);
  }

  async getById(tenantId: string, id: string): Promise<InviteRecord | null> {
    const record = this.tenantBucket(tenantId).get(id);
    return record ? clone(record) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<InviteRecord | null> {
    const normalized = email.trim().toLowerCase();
    for (const record of this.tenantBucket(tenantId).values()) {
      if (record.email.toLowerCase() === normalized) {
        return clone(record);
      }
    }
    return null;
  }

  async findByToken(tenantId: string, token: string): Promise<InviteRecord | null> {
    const normalized = token.trim();
    for (const record of this.tenantBucket(tenantId).values()) {
      if (record.token === normalized) {
        return clone(record);
      }
    }
    return null;
  }

  async create(tenantId: string, input: InviteRecord): Promise<InviteRecord> {
    const record = clone({ ...input, tenantId, id: input.id });
    this.tenantBucket(tenantId).set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: InviteUpdateInput & Partial<InviteRecord>): Promise<InviteRecord | null> {
    const bucket = this.tenantBucket(tenantId);
    const existing = bucket.get(id);
    if (!existing) return null;
    const updated: InviteRecord = clone({
      ...existing,
      ...input,
      updatedAt: input.updatedAt ? new Date(input.updatedAt) : new Date(),
    });
    bucket.set(id, updated);
    return clone(updated);
  }
}

export const inviteRepository = new InMemoryInviteRepository();
