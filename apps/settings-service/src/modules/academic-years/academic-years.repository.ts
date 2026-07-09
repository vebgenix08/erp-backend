import type { RepositoryContext } from "@school-erp/mongodb";
import type { AcademicYearCreateInput, AcademicYearListFilter, AcademicYearRecord, AcademicYearUpdateInput } from "./academic-years.model";

export interface AcademicYearRepository {
  list(tenantId: string, filter?: AcademicYearListFilter, context?: RepositoryContext): Promise<AcademicYearRecord[]>;
  getById(tenantId: string, id: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  getByCode(tenantId: string, code: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  create(tenantId: string, input: AcademicYearCreateInput, context?: RepositoryContext): Promise<AcademicYearRecord>;
  update(tenantId: string, id: string, input: AcademicYearUpdateInput, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
  activate(tenantId: string, id: string, context?: RepositoryContext): Promise<AcademicYearRecord | null>;
}

type TenantBucket = { records: Map<string, AcademicYearRecord> };

function clone(record: AcademicYearRecord): AcademicYearRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    activatedAt: record.activatedAt ? new Date(record.activatedAt) : undefined,
    deactivatedAt: record.deactivatedAt ? new Date(record.deactivatedAt) : undefined,
  };
}

function now() {
  return new Date();
}

export class InMemoryAcademicYearRepository implements AcademicYearRepository {
  private readonly buckets = new Map<string, TenantBucket>();

  private getBucket(tenantId: string): TenantBucket {
    let bucket = this.buckets.get(tenantId);
    if (!bucket) {
      bucket = { records: new Map<string, AcademicYearRecord>() };
      this.buckets.set(tenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter?: AcademicYearListFilter) {
    return [...this.getBucket(tenantId).records.values()]
      .filter((record) => !filter?.status || record.status === filter.status)
      .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.code.localeCompare(right.code))
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

  async create(tenantId: string, input: AcademicYearCreateInput) {
    const timestamp = now();
    const record: AcademicYearRecord = {
      id: `academic_year_${tenantId}_${this.getBucket(tenantId).records.size + 1}`,
      tenantId,
      code: input.code,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "INACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.getBucket(tenantId).records.set(record.id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: AcademicYearUpdateInput) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.records.get(id);
    if (!existing) return null;
    const updated: AcademicYearRecord = {
      ...existing,
      ...input,
      updatedAt: now(),
    };
    bucket.records.set(id, updated);
    return clone(updated);
  }

  async activate(tenantId: string, id: string) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.records.get(id);
    if (!existing) return null;
    const nowValue = now();
    for (const [recordId, record] of bucket.records.entries()) {
      bucket.records.set(recordId, {
        ...record,
        status: recordId === id ? "ACTIVE" : "INACTIVE",
        activatedAt: recordId === id ? nowValue : record.activatedAt,
        deactivatedAt: recordId === id ? record.deactivatedAt : record.deactivatedAt ?? nowValue,
        updatedAt: nowValue,
      });
    }
    return clone(bucket.records.get(id) as AcademicYearRecord);
  }
}

export const academicYearRepository: AcademicYearRepository = new InMemoryAcademicYearRepository();
