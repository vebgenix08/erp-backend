import type { RepositoryContext } from "@school-erp/mongodb";
import type { CampusCreateInput, CampusListFilter, CampusRecord, CampusUpdateInput } from "./campuses.model";

export interface CampusRepository {
  list(tenantId: string, filter?: CampusListFilter, context?: RepositoryContext): Promise<CampusRecord[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<CampusRecord | null>;
  getByCode(tenantId: string, code: string, context?: RepositoryContext): Promise<CampusRecord | null>;
  create(tenantId: string, input: CampusCreateInput, context?: RepositoryContext): Promise<CampusRecord>;
  update(tenantId: string, id: string, input: CampusUpdateInput, context?: RepositoryContext): Promise<CampusRecord | null>;
  deactivate(tenantId: string, id: string, context?: RepositoryContext): Promise<CampusRecord | null>;
}

type TenantBucket = {
  records: Map<string, CampusRecord>;
};

function clone(record: CampusRecord): CampusRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
  };
}

function now() {
  return new Date();
}

export class InMemoryCampusRepository implements CampusRepository {
  private readonly buckets = new Map<string, TenantBucket>();

  private getBucket(tenantId: string): TenantBucket {
    let bucket = this.buckets.get(tenantId);
    if (!bucket) {
      bucket = { records: new Map<string, CampusRecord>() };
      this.buckets.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter?: CampusListFilter) {
    const records = [...this.getBucket(tenantId).records.values()];
    return records
      .filter((record) => !filter?.status || record.status === filter.status)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    const record = this.getBucket(tenantId).records.get(id);
    return record ? clone(record) : null;
  }

  async getByCode(tenantId: string, code: string) {
    const record = [...this.getBucket(tenantId).records.values()].find((item) => item.code.toLowerCase() === code.toLowerCase());
    return record ? clone(record) : null;
  }

  async create(tenantId: string, input: CampusCreateInput) {
    const timestamp = now();
    const record: CampusRecord = {
      id: `campus_${tenantId}_${this.getBucket(tenantId).records.size + 1}`,
      tenantId,
      code: input.code,
      name: input.name,
      campusType: input.campusType,
      status: "ACTIVE",
      address: input.address,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.getBucket(tenantId).records.set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: CampusUpdateInput) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.records.get(id);
    if (!existing) return null;
    const updated: CampusRecord = {
      ...existing,
      ...input,
      updatedAt: now(),
      deactivatedAt: input.status === "INACTIVE" ? existing.deactivatedAt ?? now() : existing.deactivatedAt,
    };
    bucket.records.set(id, updated);
    return clone(updated);
  }

  async deactivate(tenantId: string, id: string) {
    return this.update(tenantId, id, { status: "INACTIVE" });
  }
}

export const campusRepository: CampusRepository = new InMemoryCampusRepository();
