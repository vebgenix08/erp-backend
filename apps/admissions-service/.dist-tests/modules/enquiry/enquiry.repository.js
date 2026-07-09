"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enquiryRepository = exports.InMemoryEnquiryRepository = void 0;
const errors_1 = require("@school-erp/errors");
const tenancy_1 = require("@school-erp/tenancy");
function createBucket() {
    return {
        sequence: 0,
        enquiries: new Map(),
    };
}
function clone(enquiry) {
    return {
        ...enquiry,
        dateOfBirth: enquiry.dateOfBirth ? new Date(enquiry.dateOfBirth) : undefined,
        createdAt: new Date(enquiry.createdAt),
        updatedAt: new Date(enquiry.updatedAt),
        closedAt: enquiry.closedAt ? new Date(enquiry.closedAt) : undefined,
    };
}
function sortByCreatedAt(left, right) {
    return left.createdAt.getTime() - right.createdAt.getTime() || left.enquiryNumber.localeCompare(right.enquiryNumber);
}
function normalizeFilter(filter) {
    return {
        status: filter?.status,
        source: filter?.source?.trim().toLowerCase() || undefined,
        search: filter?.search?.trim().toLowerCase() || undefined,
    };
}
function matchesSearch(enquiry, search) {
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
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join(" ")
        .toLowerCase();
    return haystack.includes(search);
}
class InMemoryEnquiryRepository {
    buckets = new Map();
    getBucket(tenantId) {
        const normalizedTenantId = (0, tenancy_1.normalizeTenantId)(tenantId);
        if (!normalizedTenantId) {
            throw new errors_1.BadRequestError("tenantId is required");
        }
        let bucket = this.buckets.get(normalizedTenantId);
        if (!bucket) {
            bucket = createBucket();
            this.buckets.set(normalizedTenantId, bucket);
        }
        return bucket;
    }
    async list(tenantId, filter) {
        const normalizedFilter = normalizeFilter(filter);
        return [...this.getBucket(tenantId).enquiries.values()]
            .filter((enquiry) => {
            if (normalizedFilter.status && enquiry.status !== normalizedFilter.status)
                return false;
            if (normalizedFilter.source && enquiry.source?.trim().toLowerCase() !== normalizedFilter.source)
                return false;
            if (normalizedFilter.search && !matchesSearch(enquiry, normalizedFilter.search))
                return false;
            return true;
        })
            .sort(sortByCreatedAt)
            .map(clone);
    }
    async getById(tenantId, id) {
        return this.getBucket(tenantId).enquiries.get(id) ? clone(this.getBucket(tenantId).enquiries.get(id)) : null;
    }
    async getByEnquiryNumber(tenantId, enquiryNumber) {
        const record = [...this.getBucket(tenantId).enquiries.values()].find((item) => item.enquiryNumber === enquiryNumber);
        return record ? clone(record) : null;
    }
    async nextEnquirySequence(tenantId) {
        const bucket = this.getBucket(tenantId);
        bucket.sequence += 1;
        return bucket.sequence;
    }
    async create(tenantId, input) {
        if (!input.enquiryNumber) {
            throw new errors_1.BadRequestError("enquiryNumber is required");
        }
        const bucket = this.getBucket(tenantId);
        const id = `enquiry_${tenantId}_${bucket.sequence}`;
        const record = {
            id,
            tenantId: (0, tenancy_1.normalizeTenantId)(tenantId),
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
    async update(tenantId, id, input) {
        const bucket = this.getBucket(tenantId);
        const existing = bucket.enquiries.get(id);
        if (!existing)
            return null;
        const updated = {
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
    async close(tenantId, id, input) {
        const bucket = this.getBucket(tenantId);
        const existing = bucket.enquiries.get(id);
        if (!existing)
            return null;
        const updated = {
            ...existing,
            status: "CLOSED",
            closedAt: input.closedAt,
            updatedAt: input.updatedAt,
        };
        bucket.enquiries.set(id, updated);
        return clone(updated);
    }
}
exports.InMemoryEnquiryRepository = InMemoryEnquiryRepository;
exports.enquiryRepository = new InMemoryEnquiryRepository();
