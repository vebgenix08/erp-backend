import { BadRequestError } from "@school-erp/errors";
import type { TenantScopedRepository } from "@school-erp/mongodb";
import { normalizeTenantId } from "@school-erp/tenancy";
import type { EnquiryCreateStoredInput, EnquiryListFilter, EnquiryRecord, EnquiryUpdateStoredInput } from "./enquiry.model";

export interface EnquiryRepository
  extends Omit<TenantScopedRepository<EnquiryRecord, EnquiryCreateStoredInput, EnquiryUpdateStoredInput>, "list"> {
  getByEnquiryNumber(tenantId: string, enquiryNumber: string): Promise<EnquiryRecord | null>;
  nextEnquirySequence(tenantId: string): Promise<number>;
  close(tenantId: string, id: string, input: { status: "CLOSED"; closedAt: Date; updatedAt: Date }): Promise<EnquiryRecord | null>;
  list(tenantId: string, filter?: EnquiryListFilter): Promise<EnquiryRecord[]>;
}

type TenantBucket = {
  sequence: number;
  enquiries: Map<string, EnquiryRecord>;
};

function createBucket(): TenantBucket {
  return {
    sequence: 0,
    enquiries: new Map<string, EnquiryRecord>(),
  };
}

function clone(enquiry: EnquiryRecord): EnquiryRecord {
  return {
    ...enquiry,
    dateOfBirth: enquiry.dateOfBirth ? new Date(enquiry.dateOfBirth) : undefined,
    createdAt: new Date(enquiry.createdAt),
    updatedAt: new Date(enquiry.updatedAt),
    closedAt: enquiry.closedAt ? new Date(enquiry.closedAt) : undefined,
  };
}

function sortByCreatedAt(left: EnquiryRecord, right: EnquiryRecord): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.enquiryNumber.localeCompare(right.enquiryNumber);
}

function normalizeFilter(filter?: EnquiryListFilter): EnquiryListFilter {
  return {
    status: filter?.status,
    source: filter?.source?.trim().toLowerCase() || undefined,
    search: filter?.search?.trim().toLowerCase() || undefined,
  };
}

function matchesSearch(enquiry: EnquiryRecord, search: string): boolean {
  const haystack = [
    enquiry.enquiryNumber,
    enquiry.studentName,
    enquiry.parentName,
    enquiry.phone,
    enquiry.email,
    enquiry.interestedClass,
    enquiry.source,
    enquiry.notes,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export class InMemoryEnquiryRepository implements EnquiryRepository {
  private readonly buckets = new Map<string, TenantBucket>();

  private getBucket(tenantId: string): TenantBucket {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (!normalizedTenantId) {
      throw new BadRequestError("tenantId is required");
    }
    let bucket = this.buckets.get(normalizedTenantId);
    if (!bucket) {
      bucket = createBucket();
      this.buckets.set(normalizedTenantId, bucket);
    }
    return bucket;
  }

  async list(tenantId: string, filter?: EnquiryListFilter) {
    const normalizedFilter = normalizeFilter(filter);
    return [...this.getBucket(tenantId).enquiries.values()]
      .filter((enquiry) => {
        if (normalizedFilter.status && enquiry.status !== normalizedFilter.status) return false;
        if (normalizedFilter.source && enquiry.source?.trim().toLowerCase() !== normalizedFilter.source) return false;
        if (normalizedFilter.search && !matchesSearch(enquiry, normalizedFilter.search)) return false;
        return true;
      })
      .sort(sortByCreatedAt)
      .map(clone);
  }

  async getById(tenantId: string, id: string) {
    return this.getBucket(tenantId).enquiries.get(id) ? clone(this.getBucket(tenantId).enquiries.get(id) as EnquiryRecord) : null;
  }

  async getByEnquiryNumber(tenantId: string, enquiryNumber: string) {
    const record = [...this.getBucket(tenantId).enquiries.values()].find((item) => item.enquiryNumber === enquiryNumber);
    return record ? clone(record) : null;
  }

  async nextEnquirySequence(tenantId: string) {
    const bucket = this.getBucket(tenantId);
    bucket.sequence += 1;
    return bucket.sequence;
  }

  async create(tenantId: string, input: EnquiryCreateStoredInput) {
    if (!input.enquiryNumber) {
      throw new BadRequestError("enquiryNumber is required");
    }
    const bucket = this.getBucket(tenantId);
    const id = `enquiry_${tenantId}_${bucket.sequence}`;
    const record: EnquiryRecord = {
      id,
      tenantId: normalizeTenantId(tenantId) as string,
      enquiryNumber: input.enquiryNumber,
      studentName: input.studentName,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      parentName: input.parentName,
      phone: input.phone,
      email: input.email,
      interestedClass: input.interestedClass,
      source: input.source,
      status: input.status,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      closedAt: input.closedAt,
    };
    bucket.enquiries.set(id, record);
    return clone(record);
  }

  async update(tenantId: string, id: string, input: EnquiryUpdateStoredInput) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.enquiries.get(id);
    if (!existing) return null;
    const updated: EnquiryRecord = {
      ...existing,
      tenantId: existing.tenantId,
      id: existing.id,
      enquiryNumber: existing.enquiryNumber,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: input.updatedAt,
      closedAt: input.closedAt ?? existing.closedAt,
      status: input.status ?? existing.status,
      studentName: input.studentName ?? existing.studentName,
      dateOfBirth: input.dateOfBirth ?? existing.dateOfBirth,
      gender: input.gender ?? existing.gender,
      parentName: input.parentName ?? existing.parentName,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
      interestedClass: input.interestedClass ?? existing.interestedClass,
      source: input.source ?? existing.source,
      notes: input.notes ?? existing.notes,
    };
    bucket.enquiries.set(id, updated);
    return clone(updated);
  }

  async close(tenantId: string, id: string, input: { status: "CLOSED"; closedAt: Date; updatedAt: Date }) {
    const bucket = this.getBucket(tenantId);
    const existing = bucket.enquiries.get(id);
    if (!existing) return null;
    const updated: EnquiryRecord = {
      ...existing,
      status: "CLOSED",
      closedAt: input.closedAt,
      updatedAt: input.updatedAt,
    };
    bucket.enquiries.set(id, updated);
    return clone(updated);
  }
}

export const enquiryRepository: EnquiryRepository = new InMemoryEnquiryRepository();
